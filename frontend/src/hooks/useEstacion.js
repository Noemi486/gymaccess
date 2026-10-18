import { useCallback, useEffect, useRef, useState } from 'react';
import { solicitar } from '../api/cliente.js';
import { analizarFotograma, cargarModelos, INDICACIONES } from '../lib/reconocimientoFacial.js';

// Lógica de la Estación de acceso: un reductor puro (fácil de probar con un reloj simulado) y un hook
// que lo conecta con la cámara, el reconocimiento facial y la API. Solo se envía el descriptor
// (128 números); nunca una imagen. El servidor es quien decide si se autoriza el acceso.

export const DURACION_RESULTADO_MS = 5000; // el resultado se queda 5 s y la estación vuelve a la espera
export const ENFRIAMIENTO_MS = 10_000; // espera mínima antes de aceptar otro intento de la misma persona
export const ENFRIAMIENTO_ERROR_MS = 3000; // tras un fallo de red se reintenta pronto
export const PAUSA_MS = 30_000; // pausa tras 3 "Rostro no reconocido" seguidos
export const MAX_NO_RECONOCIDOS = 3;
export const FOTOGRAMAS_ESTABLES = 3; // fotogramas seguidos con un único rostro antes de enviar
export const FOTOGRAMAS_AUSENCIA = 4; // fotogramas sin rostro (≈ 1 s) para dar por terminada a una persona
export const INTERVALO_ANALISIS_MS = 250; // ≈ 4 análisis por segundo
const DISCREPANCIA_ENTRE_FOTOGRAMAS = 0.4;

export const MOTIVO_NO_RECONOCIDO = 'Rostro no reconocido';
export const MENSAJE_PAUSA = 'No te reconocemos. Pide ayuda en recepción';
export const AVISO_FALLO_ENVIO = 'No se pudo verificar. Inténtalo de nuevo.';

// fase: cargando_modelos | espera | analizando | resultado | pausa | error_camara
// `hasta`: instante en que termina el resultado o la pausa. `libreDesde`: instante desde el que se acepta otro intento.
export const estadoInicial = { fase: 'cargando_modelos', resultado: null, fallos: 0, hasta: 0, libreDesde: 0, aviso: null, error: null };

// ¿Se puede enviar un intento ahora? Solo en espera y fuera del enfriamiento.
export function puedeEnviar(estado, ahora) {
  return estado.fase === 'espera' && ahora >= estado.libreDesde;
}

export function estacionReducer(estado, accion) {
  switch (accion.tipo) {
    case 'modelos_listos':
      return estado.fase === 'cargando_modelos' ? { ...estado, fase: 'espera' } : estado;

    case 'reiniciar':
      return estadoInicial;

    case 'camara_error':
      return { ...estado, fase: 'error_camara', error: accion.error, resultado: null };

    case 'camara_lista':
      return estado.fase === 'error_camara' ? { ...estado, fase: 'espera', error: null } : estado;

    case 'enviar':
      if (!puedeEnviar(estado, accion.ahora)) return estado;
      return { ...estado, fase: 'analizando', libreDesde: accion.ahora + ENFRIAMIENTO_MS, aviso: null };

    case 'respuesta': {
      if (estado.fase !== 'analizando') return estado;
      const { respuesta, ahora } = accion;
      const noReconocido = respuesta.resultado === 'rechazado' && respuesta.motivo === MOTIVO_NO_RECONOCIDO && !respuesta.cliente;
      // Un cliente identificado (aunque se rechace por otro motivo) reinicia el conteo.
      const fallos = noReconocido ? estado.fallos + 1 : respuesta.cliente ? 0 : estado.fallos;
      if (fallos >= MAX_NO_RECONOCIDOS) return { ...estado, fase: 'pausa', resultado: respuesta, fallos, hasta: ahora + PAUSA_MS };
      return { ...estado, fase: 'resultado', resultado: respuesta, fallos, hasta: ahora + DURACION_RESULTADO_MS };
    }

    case 'fallo_envio':
      if (estado.fase !== 'analizando') return estado;
      return { ...estado, fase: 'espera', libreDesde: accion.ahora + ENFRIAMIENTO_ERROR_MS, aviso: AVISO_FALLO_ENVIO };

    // La persona se fue: la siguiente se acepta sin esperar el enfriamiento (la pausa no se salta).
    case 'persona_ausente':
      return estado.libreDesde === 0 ? estado : { ...estado, libreDesde: 0 };

    case 'tick':
      if (estado.fase === 'resultado' && accion.ahora >= estado.hasta) return { ...estado, fase: 'espera', resultado: null };
      if (estado.fase === 'pausa' && accion.ahora >= estado.hasta) return { ...estado, fase: 'espera', resultado: null, fallos: 0 };
      return estado;

    default:
      return estado;
  }
}

function distancia(a, b) {
  let suma = 0;
  for (let i = 0; i < a.length; i += 1) suma += (a[i] - b[i]) ** 2;
  return Math.sqrt(suma);
}

export function promediar(descriptores) {
  return Array.from({ length: descriptores[0].length }, (_, k) => descriptores.reduce((suma, d) => suma + d[k], 0) / descriptores.length);
}

const enviarDescriptor = (descriptor) =>
  solicitar('/accesos/identificar', { metodo: 'POST', cuerpo: { descriptor: Array.from(descriptor) } });

const ERRORES_CAMARA = ['denegada', 'sin_camara', 'ocupada'];

// Conecta cámara + reconocimiento + API. `camara` es lo que devuelve useCamara(). Todo es inyectable para las pruebas.
export function useEstacion({
  camara,
  cargar = cargarModelos,
  analizar = analizarFotograma,
  enviar = enviarDescriptor,
  ahora = Date.now,
  intervaloMs = INTERVALO_ANALISIS_MS,
}) {
  // El estado vive en una referencia que se actualiza al instante (el reductor es puro) y se copia a React
  // para dibujar. Así las decisiones del ciclo de análisis nunca se basan en un estado atrasado.
  const [estado, setEstado] = useState(estadoInicial);
  const [indicacion, setIndicacion] = useState(null);
  const estadoRef = useRef(estadoInicial);
  const despachar = useCallback((accion) => {
    const siguiente = estacionReducer(estadoRef.current, accion);
    if (siguiente === estadoRef.current) return;
    estadoRef.current = siguiente;
    setEstado(siguiente);
  }, []);
  const { videoRef, estado: estadoCamara, iniciar } = camara;
  const iniciarRef = useRef(iniciar);
  iniciarRef.current = iniciar;
  const [intentoCarga, setIntentoCarga] = useState(0);

  // Carga los modelos y luego enciende la cámara.
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        await cargar();
      } catch {
        if (activo) despachar({ tipo: 'camara_error', error: 'modelos' });
        return;
      }
      if (!activo) return;
      despachar({ tipo: 'modelos_listos' });
      await iniciarRef.current();
    })();
    return () => {
      activo = false;
    };
  }, [cargar, intentoCarga, despachar]);

  // Refleja los problemas de la cámara y su recuperación.
  useEffect(() => {
    if (ERRORES_CAMARA.includes(estadoCamara)) despachar({ tipo: 'camara_error', error: estadoCamara });
    else if (estadoCamara === 'activa') despachar({ tipo: 'camara_lista' });
  }, [estadoCamara, despachar]);

  // Ciclo de análisis (≈ 4 por segundo) mientras la cámara está activa.
  useEffect(() => {
    if (estadoCamara !== 'activa') return undefined;
    let ocupado = false;
    let estables = [];
    let ausentes = 0;

    async function paso() {
      const t = ahora();
      despachar({ tipo: 'tick', ahora: t });
      const actual = estadoRef.current;
      if (ocupado || !['espera', 'resultado'].includes(actual.fase)) return;
      ocupado = true;
      try {
        const analisis = await analizar(videoRef.current);
        if (analisis.estado === 'sin_rostro') {
          estables = [];
          setIndicacion(null);
          ausentes += 1;
          if (ausentes >= FOTOGRAMAS_AUSENCIA) despachar({ tipo: 'persona_ausente' });
          return;
        }
        ausentes = 0;
        if (analisis.estado !== 'ok') {
          estables = []; // varios rostros, lejos o poca claridad: no se envía nada
          setIndicacion(INDICACIONES[analisis.estado] ?? null);
          return;
        }
        setIndicacion(null);
        const anterior = estables[estables.length - 1];
        if (anterior && distancia(anterior, analisis.descriptor) > DISCREPANCIA_ENTRE_FOTOGRAMAS) estables = [];
        estables.push(analisis.descriptor);
        if (estables.length < FOTOGRAMAS_ESTABLES) return;

        const momento = ahora();
        if (!puedeEnviar(estadoRef.current, momento)) return;
        const descriptor = promediar(estables);
        estables = [];
        despachar({ tipo: 'enviar', ahora: momento });
        try {
          const respuesta = await enviar(descriptor);
          despachar({ tipo: 'respuesta', respuesta, ahora: ahora() });
        } catch {
          despachar({ tipo: 'fallo_envio', ahora: ahora() });
        }
      } catch {
        // Un fotograma que falla se ignora; el siguiente lo intenta de nuevo.
      } finally {
        ocupado = false;
      }
    }

    const temporizador = setInterval(paso, intervaloMs);
    return () => clearInterval(temporizador);
  }, [estadoCamara, analizar, enviar, ahora, intervaloMs, videoRef, despachar]);

  const reintentarModelos = useCallback(() => {
    despachar({ tipo: 'reiniciar' });
    setIntentoCarga((n) => n + 1);
  }, [despachar]);

  return { estado, indicacion, reintentarModelos };
}
