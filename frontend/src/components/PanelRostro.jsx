import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { formatearFechaCorta } from '../utils/formato.js';
import RegistrarRostro from './RegistrarRostro.jsx';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import Spinner from './ui/Spinner.jsx';
import { useToast } from './ui/Toast.jsx';

// Rostro del cliente en su detalle (administrador y recepcionista). Nunca muestra datos biométricos.
// Desactivar y reactivar son solo del administrador (el servidor lo vuelve a validar).
export default function PanelRostro({ cliente, rol }) {
  const { mostrar } = useToast();
  const esAdmin = rol === 'administrador';
  const clienteActivo = cliente.estado === 'activo';
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [registrando, setRegistrando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await solicitar(`/clientes/${cliente.id_cliente}/rostro`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el estado del rostro.');
    } finally {
      setCargando(false);
    }
  }, [cliente.id_cliente]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cerrarRegistro = useCallback(() => setRegistrando(false), []);
  const cancelarConfirmacion = useCallback(() => setConfirmando(false), []);

  function alGuardar() {
    setRegistrando(false);
    mostrar({ tipo: 'exito', texto: 'Rostro registrado.' });
    cargar();
  }

  async function cambiarEstado(idRostro, estado) {
    setAviso(null);
    try {
      await solicitar(`/rostros/${idRostro}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
      mostrar({ tipo: 'exito', texto: estado === 'activo' ? 'Rostro reactivado.' : 'Rostro desactivado.' });
      cargar();
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el estado del rostro.');
    }
  }

  async function confirmarDesactivacion() {
    setConfirmando(false);
    await cambiarEstado(datos.activo.id_rostro, 'inactivo');
  }

  if (cargando) return <Spinner etiqueta="Cargando rostro…" />;
  if (error) {
    return (
      <Card titulo="Rostro">
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      </Card>
    );
  }

  // El más reciente de los inactivos es el que se puede reactivar.
  const reactivable = !datos.registrado ? datos.historial[0] : null;

  return (
    <Card titulo="Rostro" className="panel-rostro">
      {aviso && (
        <div className="mensaje mensaje-error" role="alert">
          {aviso}
        </div>
      )}
      <p>{datos.registrado ? `Rostro registrado el ${formatearFechaCorta(datos.activo.fecha_registro)}.` : 'Sin rostro registrado.'}</p>
      {!datos.registrado && reactivable && <p className="texto-suave">Hay un rostro anterior desactivado.</p>}

      <div className="acciones acciones-izquierda">
        {clienteActivo && (
          <Button onClick={() => setRegistrando(true)}>{datos.registrado ? 'Reemplazar rostro' : 'Registrar rostro'}</Button>
        )}
        {esAdmin && datos.registrado && (
          <Button variante="secundario" onClick={() => setConfirmando(true)}>
            Desactivar rostro
          </Button>
        )}
        {esAdmin && reactivable && clienteActivo && (
          <Button variante="secundario" onClick={() => cambiarEstado(reactivable.id_rostro, 'activo')}>
            Reactivar rostro
          </Button>
        )}
      </div>

      {registrando && <RegistrarRostro cliente={cliente} onCerrar={cerrarRegistro} onGuardado={alGuardar} />}

      <ConfirmDialog
        abierto={confirmando}
        titulo="Desactivar rostro"
        texto="El cliente ya no podrá entrar con su rostro hasta que se registre uno nuevo o un administrador lo reactive. El registro no se borra."
        textoConfirmar="Desactivar"
        onConfirmar={confirmarDesactivacion}
        onCancelar={cancelarConfirmacion}
      />
    </Card>
  );
}
