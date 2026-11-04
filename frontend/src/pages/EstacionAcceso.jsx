import { Dumbbell, LogIn, LogOut, Maximize } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CamaraFacial from '../components/CamaraFacial.jsx';
import Button from '../components/ui/Button.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useCamara } from '../hooks/useCamara.js';
import { MENSAJE_PAUSA, MOTIVO_NO_RECONOCIDO, useEstacion } from '../hooks/useEstacion.js';

// Qué debe hacer la persona según el motivo del rechazo (el motivo exacto se muestra aparte).
function ayudaDe(motivo) {
  if (motivo === 'Pago pendiente') return 'Pasa por recepción para regularizar tu pago.';
  if (motivo === MOTIVO_NO_RECONOCIDO) return 'No te reconocimos. Pide ayuda en recepción.';
  return 'Consulta tu situación en recepción.';
}

function textoDias(dias) {
  if (dias <= 0) return 'Tu membresía vence hoy';
  if (dias === 1) return 'Te queda 1 día';
  return `Te quedan ${dias} días`;
}

function Resultado({ resultado }) {
  const nombre = resultado.cliente ? `${resultado.cliente.nombre} ${resultado.cliente.apellido}` : null;
  // Salida (spec 004, US8): solo se registra la hora; no se informa de la membresía.
  if (resultado.tipo === 'salida' && resultado.resultado === 'autorizado') {
    return (
      <div className="estacion-resultado estacion-salida-ok" role="status">
        <h2>Salida registrada</h2>
        <p className="estacion-nombre">Hasta luego, {nombre}</p>
      </div>
    );
  }
  if (resultado.resultado === 'autorizado') {
    return (
      <div className="estacion-resultado estacion-autorizado" role="status">
        <h2>Acceso autorizado</h2>
        <p className="estacion-nombre">{nombre}</p>
        <p>{resultado.membresia.plan}</p>
        <p>{textoDias(resultado.membresia.dias_restantes)}</p>
      </div>
    );
  }
  return (
    <div className="estacion-resultado estacion-rechazado" role="status">
      <h2>Acceso rechazado</h2>
      {nombre && <p className="estacion-nombre">{nombre}</p>}
      <p className="estacion-motivo">{resultado.motivo}</p>
      <p>{ayudaDe(resultado.motivo)}</p>
    </div>
  );
}

function Panel({ estado, reintentarModelos }) {
  switch (estado.fase) {
    case 'cargando_modelos':
      return (
        <div className="estacion-mensaje">
          <Spinner etiqueta="Cargando el reconocimiento facial…" />
          <p>Cargando el reconocimiento facial…</p>
        </div>
      );
    case 'error_camara':
      if (estado.error === 'modelos') {
        return (
          <div className="estacion-mensaje">
            <div className="mensaje mensaje-error" role="alert">
              No se pudieron cargar los modelos de reconocimiento facial. Revisa la conexión e inténtalo de nuevo.
            </div>
            <Button onClick={reintentarModelos}>Reintentar</Button>
          </div>
        );
      }
      return (
        <div className="estacion-mensaje">
          <p>La estación necesita la cámara para funcionar.</p>
        </div>
      );
    case 'analizando':
      return (
        <div className="estacion-mensaje" role="status">
          <Spinner etiqueta="Verificando…" />
          <p>Verificando…</p>
        </div>
      );
    case 'resultado':
      return <Resultado resultado={estado.resultado} />;
    case 'pausa':
      return (
        <div className="estacion-resultado estacion-rechazado" role="status">
          <h2>{MENSAJE_PAUSA}</h2>
          <p>La estación volverá a estar lista en unos segundos.</p>
        </div>
      );
    default:
      return (
        <div className="estacion-mensaje" role="status">
          <p className="estacion-espera">Colócate frente a la cámara</p>
          {estado.aviso && <p className="texto-suave">{estado.aviso}</p>}
        </div>
      );
  }
}

// Estación de acceso: pantalla completa para la entrada del gimnasio (fuera del Layout).
// El personal la deja abierta; cada persona se identifica con su rostro y el servidor decide el acceso.
export default function EstacionAcceso() {
  const navegar = useNavigate();
  const camara = useCamara();
  // El modo empieza siempre en Entrada al abrir la estación (FR-026).
  const [modo, setModo] = useState('entrada');
  const { estado, indicacion, reintentarModelos } = useEstacion({ camara, tipo: modo });

  function pantallaCompleta() {
    Promise.resolve(document.documentElement.requestFullscreen?.()).catch(() => {});
  }

  function salir() {
    camara.detener();
    if (document.fullscreenElement) Promise.resolve(document.exitFullscreen?.()).catch(() => {});
    navegar('/');
  }

  return (
    <main className="estacion" aria-label="Estación de acceso">
      <header className="estacion-barra">
        <div className="estacion-marca">
          <span className="sidebar-logo" aria-hidden="true">
            <Dumbbell size={22} />
          </span>
          <strong>GymAccess</strong>
          <span className="estacion-subtitulo">Estación de acceso</span>
        </div>
        <div className="estacion-modo" role="group" aria-label="Modo de la estación">
          <button type="button" className="estacion-modo-boton" aria-pressed={modo === 'entrada'} onClick={() => setModo('entrada')}>
            <LogIn size={16} aria-hidden="true" /> Entrada
          </button>
          <button type="button" className="estacion-modo-boton estacion-modo-salida" aria-pressed={modo === 'salida'} onClick={() => setModo('salida')}>
            <LogOut size={16} aria-hidden="true" /> Salida
          </button>
        </div>
        <div className="estacion-acciones">
          <Button variante="secundario" icono={<Maximize size={16} aria-hidden="true" />} onClick={pantallaCompleta}>
            Pantalla completa
          </Button>
          <Button variante="secundario" icono={<LogOut size={16} aria-hidden="true" />} onClick={salir}>
            Salir
          </Button>
        </div>
      </header>

      <div className="estacion-cuerpo">
        <div className="estacion-camara">
          <CamaraFacial camara={camara} indicacion={estado.fase === 'espera' ? indicacion : null} />
        </div>
        <section className={`estacion-panel${modo === 'salida' ? ' estacion-panel-salida' : ''}`} aria-label="Resultado">
          <p className={`estacion-modo-actual${modo === 'salida' ? ' es-salida' : ''}`}>{modo === 'salida' ? 'Modo: SALIDA' : 'Modo: ENTRADA'}</p>
          <Panel estado={estado} reintentarModelos={reintentarModelos} />
        </section>
      </div>
    </main>
  );
}
