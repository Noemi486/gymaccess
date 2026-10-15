import Button from './ui/Button.jsx';
import Spinner from './ui/Spinner.jsx';

const MENSAJES_ERROR = {
  denegada:
    'No se permitió el acceso a la cámara. Haz clic en el candado de la barra de direcciones, permite la cámara para este sitio y vuelve a intentarlo.',
  sin_camara: 'No se encontró una cámara en este equipo (o el navegador no la permite en esta dirección). Conecta una cámara e inténtalo de nuevo.',
  ocupada: 'La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.',
};

// Vista de la cámara con marco de escáner (esquinas verdes). `camara` es lo que devuelve useCamara();
// `indicacion` es el mensaje de ayuda actual (poca luz, acércate, un rostro a la vez…).
export default function CamaraFacial({ camara, indicacion }) {
  const { videoRef, estado, iniciar } = camara;
  const conError = estado in MENSAJES_ERROR;

  return (
    <div className="camara-facial">
      <div className={`camara-marco ${estado === 'activa' ? 'camara-activa' : ''}`}>
        <video ref={videoRef} className="camara-video" autoPlay playsInline muted aria-label="Vista de la cámara" />
        {estado === 'activa' && (
          <>
            <span className="esquina esquina-ai" aria-hidden="true" />
            <span className="esquina esquina-ad" aria-hidden="true" />
            <span className="esquina esquina-bi" aria-hidden="true" />
            <span className="esquina esquina-bd" aria-hidden="true" />
          </>
        )}
        {estado === 'solicitando' && (
          <div className="camara-centro">
            <Spinner etiqueta="Solicitando acceso a la cámara…" />
          </div>
        )}
        {estado === 'inactiva' && <div className="camara-centro texto-suave">La cámara está apagada.</div>}
      </div>

      {conError && (
        <div className="mensaje mensaje-error" role="alert">
          {MENSAJES_ERROR[estado]}
          <div className="acciones acciones-izquierda">
            <Button variante="secundario" onClick={iniciar}>
              Reintentar
            </Button>
          </div>
        </div>
      )}
      {estado === 'activa' && indicacion && (
        <p className="camara-indicacion" role="status">
          {indicacion}
        </p>
      )}
    </div>
  );
}
