import { useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useCamara } from '../hooks/useCamara.js';
import { capturarMuestras, cargarModelos, INDICACIONES } from '../lib/reconocimientoFacial.js';
import CamaraFacial from './CamaraFacial.jsx';
import Button from './ui/Button.jsx';

// Diálogo para registrar (o reemplazar) el rostro de un cliente.
// Requiere el consentimiento del cliente. Solo se envía el descriptor (128 números): nunca una imagen.
export default function RegistrarRostro({ cliente, onCerrar, onGuardado }) {
  const camara = useCamara();
  const { estado: estadoCamara, iniciar, detener } = camara;
  const [consentimiento, setConsentimiento] = useState(false);
  const [modelos, setModelos] = useState('pendiente'); // pendiente | cargando | listos | error
  const [errorModelos, setErrorModelos] = useState(null);
  const [indicacion, setIndicacion] = useState(null);
  const [capturando, setCapturando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  });

  function cerrar() {
    detener();
    onCerrar();
  }

  async function activarCamara() {
    setError(null);
    setErrorModelos(null);
    setModelos('cargando');
    try {
      await cargarModelos();
      setModelos('listos');
    } catch (e) {
      setModelos('error');
      setErrorModelos(e.message);
      return;
    }
    await iniciar();
  }

  async function capturar() {
    setError(null);
    setIndicacion(null);
    setCapturando(true);
    try {
      const resultado = await capturarMuestras(camara.videoRef.current);
      if (resultado.estado !== 'ok') {
        setIndicacion(INDICACIONES[resultado.estado] ?? INDICACIONES.sin_rostro);
        return;
      }
      const guardado = await solicitar(`/clientes/${cliente.id_cliente}/rostro`, {
        metodo: 'POST',
        cuerpo: { descriptor: resultado.descriptor, consentimiento: true },
      });
      detener();
      onGuardado(guardado);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo registrar el rostro. Inténtalo de nuevo.');
    } finally {
      setCapturando(false);
    }
  }

  const camaraActiva = estadoCamara === 'activa';

  return (
    <div className="fondo-modal" role="presentation">
      <div className="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="titulo-registrar-rostro">
        <h2 id="titulo-registrar-rostro">Registrar rostro</h2>
        <p>
          Cliente: <strong>{`${cliente.nombre} ${cliente.apellido}`}</strong>
        </p>

        {error && (
          <div className="mensaje mensaje-error" role="alert">
            {error}
          </div>
        )}
        {errorModelos && (
          <div className="mensaje mensaje-error" role="alert">
            {errorModelos}
          </div>
        )}

        <label className="casilla">
          <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
          El cliente autoriza el registro de su rostro para controlar el acceso al gimnasio.
        </label>
        <p className="texto-suave">
          No se guarda ninguna foto: solo una representación numérica cifrada que se usa únicamente para identificar al cliente en la entrada.
        </p>

        <CamaraFacial camara={camara} indicacion={indicacion} />

        <div className="acciones">
          <Button variante="secundario" onClick={cerrar}>
            Cancelar
          </Button>
          {camaraActiva ? (
            <Button onClick={capturar} cargando={capturando}>
              Capturar rostro
            </Button>
          ) : (
            <Button onClick={activarCamara} disabled={!consentimiento} cargando={modelos === 'cargando' || estadoCamara === 'solicitando'}>
              Activar cámara
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
