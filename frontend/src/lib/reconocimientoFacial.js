// ÚNICA puerta de entrada a @vladmandic/face-api. El resto de la aplicación no importa la biblioteca,
// y en las pruebas este módulo se sustituye por un doble.
//
// Privacidad: aquí solo se calculan descriptores (128 números). Nunca se guarda, exporta ni envía una imagen:
// el vídeo se analiza en el navegador y los fotogramas no se copian a ningún canvas propio.

const RUTA_MODELOS = '/models';
const TAMANO_MINIMO = 0.25; // el rostro debe medir al menos el 25 % del ancho del vídeo
const CONFIANZA_MINIMA = 0.6;
const DISCREPANCIA_MAXIMA = 0.4; // entre muestras de una misma captura

let promesaCarga = null;
let biblioteca = null;

// Importa la biblioteca (fragmento aparte, solo cuando se necesita) y carga los tres modelos, una sola vez.
export function cargarModelos() {
  if (!promesaCarga) {
    promesaCarga = (async () => {
      try {
        const faceapi = await import('@vladmandic/face-api');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(RUTA_MODELOS),
          faceapi.nets.faceLandmark68Net.loadFromUri(RUTA_MODELOS),
          faceapi.nets.faceRecognitionNet.loadFromUri(RUTA_MODELOS),
        ]);
        biblioteca = faceapi;
      } catch {
        promesaCarga = null; // permite reintentar
        throw new Error('No se pudieron cargar los modelos de reconocimiento facial. Revisa la conexión e inténtalo de nuevo.');
      }
    })();
  }
  return promesaCarga;
}

// Analiza el fotograma actual del <video>.
// Devuelve { estado, descriptor?, confianza?, tamano? } con estado: sin_rostro | varios | lejos | baja_confianza | ok.
// Solo con "ok" incluye el descriptor (Float32Array de 128).
export async function analizarFotograma(video) {
  if (!biblioteca) await cargarModelos();
  const opciones = new biblioteca.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
  const rostros = await biblioteca.detectAllFaces(video, opciones).withFaceLandmarks().withFaceDescriptors();

  if (rostros.length === 0) return { estado: 'sin_rostro' };
  if (rostros.length > 1) return { estado: 'varios' };

  const [{ detection, descriptor }] = rostros;
  const tamano = video.videoWidth > 0 ? detection.box.width / video.videoWidth : 0;
  const confianza = detection.score;
  if (tamano < TAMANO_MINIMO) return { estado: 'lejos', tamano, confianza };
  if (confianza < CONFIANZA_MINIMA) return { estado: 'baja_confianza', tamano, confianza };
  return { estado: 'ok', descriptor, tamano, confianza };
}

const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function distancia(a, b) {
  let suma = 0;
  for (let i = 0; i < a.length; i += 1) suma += (a[i] - b[i]) ** 2;
  return Math.sqrt(suma);
}

// Reúne `cantidad` muestras válidas (un solo rostro claro). Resultado:
//   { estado: 'ok', descriptor }   descriptor promedio, arreglo de 128 números
//   { estado: <el último problema> }   no se logró reunir las muestras (sin_rostro, varios, lejos, baja_confianza)
//   { estado: 'inconsistente' }    dos muestras difieren más de 0,4: se descarta toda la captura
export async function capturarMuestras(video, { cantidad = 5, intervaloMs = 300, maxIntentos = cantidad * 4 } = {}) {
  const muestras = [];
  let ultimoProblema = 'sin_rostro';
  for (let intento = 0; intento < maxIntentos && muestras.length < cantidad; intento += 1) {
    const analisis = await analizarFotograma(video);
    if (analisis.estado === 'ok') muestras.push(analisis.descriptor);
    else ultimoProblema = analisis.estado;
    if (muestras.length < cantidad) await pausa(intervaloMs);
  }
  if (muestras.length < cantidad) return { estado: ultimoProblema };

  for (let i = 0; i < muestras.length; i += 1) {
    for (let j = i + 1; j < muestras.length; j += 1) {
      if (distancia(muestras[i], muestras[j]) > DISCREPANCIA_MAXIMA) return { estado: 'inconsistente' };
    }
  }

  const promedio = Array.from({ length: 128 }, (_, k) => muestras.reduce((suma, m) => suma + m[k], 0) / muestras.length);
  return { estado: 'ok', descriptor: promedio };
}

// Indicaciones para la persona según el estado del análisis.
export const INDICACIONES = {
  sin_rostro: 'No se ve ningún rostro. Colócate frente a la cámara.',
  varios: 'Hay más de un rostro. Debe aparecer una sola persona.',
  lejos: 'Acércate un poco más a la cámara.',
  baja_confianza: 'No se ve con claridad. Mejora la iluminación y mira de frente.',
  inconsistente: 'Se movió el rostro durante la captura. Mantente quieto, mira de frente e inténtalo de nuevo.',
};
