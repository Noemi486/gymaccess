import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { formatearFechaCorta, formatearMoneda } from '../utils/formato.js';
import AsignarMembresia from './AsignarMembresia.jsx';
import RegistrarPago from './RegistrarPago.jsx';
import RenovarMembresia from './RenovarMembresia.jsx';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import Spinner from './ui/Spinner.jsx';
import Table from './ui/Table.jsx';
import { useToast } from './ui/Toast.jsx';

const TEXTO_ACCION = {
  suspender: {
    titulo: 'Suspender membresía',
    texto: 'El cliente no podrá entrar mientras esté suspendida. Se puede reactivar después.',
    confirmar: 'Suspender',
    exito: 'Membresía suspendida.',
  },
  reactivar: {
    titulo: 'Reactivar membresía',
    texto: 'La membresía volverá a su estado normal con la misma fecha de fin.',
    confirmar: 'Reactivar',
    exito: 'Membresía reactivada.',
  },
  cancelar: {
    titulo: 'Cancelar membresía',
    texto: 'La cancelación no se puede deshacer. El cliente podrá recibir una membresía nueva.',
    confirmar: 'Sí, cancelar',
    exito: 'Membresía cancelada.',
  },
};

const textoDias = (dias) => {
  if (dias < 0) return `Venció hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
  if (dias === 0) return 'Vence hoy';
  return `${dias} ${dias === 1 ? 'día restante' : 'días restantes'}`;
};

function ResumenMembresia({ membresia, titulo }) {
  return (
    <div className="membresia-resumen">
      <div className="membresia-encabezado">
        <div>
          {titulo && <p className="membresia-titulo">{titulo}</p>}
          <strong className="membresia-plan">{membresia.tipo.nombre}</strong>
        </div>
        <div className="membresia-insignias">
          <Badge estado={membresia.estado} />
          {membresia.por_vencer && <Badge estado="por_vencer" />}
        </div>
      </div>
      <dl className="membresia-datos">
        <div>
          <dt>Inicio</dt>
          <dd>{formatearFechaCorta(membresia.fecha_inicio)}</dd>
        </div>
        <div>
          <dt>Fin</dt>
          <dd>{formatearFechaCorta(membresia.fecha_fin)}</dd>
        </div>
        {membresia.estado !== 'proxima' && membresia.estado !== 'cancelada' && (
          <div>
            <dt>Vigencia</dt>
            <dd>{textoDias(membresia.dias_restantes)}</dd>
          </div>
        )}
        <div>
          <dt>Precio</dt>
          <dd>{formatearMoneda(membresia.precio)}</dd>
        </div>
      </dl>
      {membresia.adeudo > 0 && (
        <p className="membresia-adeudo" role="status">
          Adeudo: <strong>{formatearMoneda(membresia.adeudo)}</strong>
        </p>
      )}
    </div>
  );
}

// Membresías del cliente en su detalle: actual, próxima e historial (administrador y recepcionista).
// Suspender, reactivar y cancelar son solo del administrador (el servidor lo vuelve a validar).
export default function PanelMembresia({ idCliente, clienteActivo, rol }) {
  const { mostrar } = useToast();
  const esAdmin = rol === 'administrador';
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [avisoAccion, setAvisoAccion] = useState(null);
  const [asignando, setAsignando] = useState(false);
  const [renovando, setRenovando] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null); // { accion, membresia }

  const cargar = useCallback(async () => {
    try {
      setDatos(await solicitar(`/clientes/${idCliente}/membresias`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar las membresías.');
    } finally {
      setCargando(false);
    }
  }, [idCliente]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cerrarAsignar = useCallback(() => setAsignando(false), []);
  const cerrarRenovar = useCallback(() => setRenovando(null), []);
  const cerrarPago = useCallback(() => setPagando(null), []);
  const cancelarConfirmacion = useCallback(() => setConfirmacion(null), []);

  function alGuardar(mensaje) {
    return () => {
      setAsignando(false);
      setRenovando(null);
      setPagando(null);
      mostrar({ tipo: 'exito', texto: mensaje });
      cargar();
    };
  }

  async function confirmarAccion() {
    const { accion, membresia } = confirmacion;
    setConfirmacion(null);
    setAvisoAccion(null);
    try {
      await solicitar(`/membresias/${membresia.id_membresia}/estado`, { metodo: 'PATCH', cuerpo: { accion } });
      mostrar({ tipo: 'exito', texto: TEXTO_ACCION[accion].exito });
      cargar();
    } catch (e) {
      setAvisoAccion(e instanceof ErrorApi ? e.message : 'No se pudo completar la acción.');
    }
  }

  if (cargando) return <Spinner etiqueta="Cargando membresías…" />;
  if (error) {
    return (
      <Card titulo="Membresía">
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      </Card>
    );
  }

  const { actual, proxima, historial } = datos;
  // Se renueva la vigente (si no hay ya una renovación) o, sin nada en curso, la más reciente que venció.
  const renovable = !actual && !proxima && historial[0]?.estado === 'vencida' ? historial[0] : null;
  const puedeAsignar = clienteActivo && !actual && !proxima;
  const accionesAdmin = (membresia) =>
    (esAdmin || membresia.estado === 'pendiente_de_pago') && (
      <div className="acciones acciones-fila">
        {membresia.estado === 'pendiente_de_pago' && <Button onClick={() => setPagando(membresia)}>Registrar pago</Button>}
        {esAdmin && membresia.estado === 'suspendida' && (
          <Button variante="secundario" onClick={() => setConfirmacion({ accion: 'reactivar', membresia })}>
            Reactivar
          </Button>
        )}
        {esAdmin && membresia.estado !== 'suspendida' && (
          <Button variante="secundario" onClick={() => setConfirmacion({ accion: 'suspender', membresia })}>
            Suspender
          </Button>
        )}
        {esAdmin && (
          <Button variante="secundario" onClick={() => setConfirmacion({ accion: 'cancelar', membresia })}>
            Cancelar membresía
          </Button>
        )}
      </div>
    );

  const columnas = [
    { clave: 'plan', etiqueta: 'Plan', render: (m) => m.tipo.nombre },
    { clave: 'inicio', etiqueta: 'Inicio', render: (m) => formatearFechaCorta(m.fecha_inicio) },
    { clave: 'fin', etiqueta: 'Fin', render: (m) => formatearFechaCorta(m.fecha_fin) },
    { clave: 'precio', etiqueta: 'Precio', render: (m) => formatearMoneda(m.precio) },
    { clave: 'estado', etiqueta: 'Estado', render: (m) => <Badge estado={m.estado} /> },
  ];

  return (
    <Card titulo="Membresía" className="panel-membresia">
      {avisoAccion && (
        <div className="mensaje mensaje-error" role="alert">
          {avisoAccion}
        </div>
      )}

      {actual ? (
        <>
          <ResumenMembresia membresia={actual} />
          <div className="acciones acciones-izquierda">
            {actual.estado === 'vigente' && !proxima && clienteActivo && (
              <Button onClick={() => setRenovando(actual)}>Renovar</Button>
            )}
            {accionesAdmin(actual)}
          </div>
        </>
      ) : (
        <p className="texto-suave">{proxima ? 'No hay una membresía en curso.' : 'El cliente no tiene una membresía en curso.'}</p>
      )}

      {proxima && (
        <>
          <hr className="separador" />
          <ResumenMembresia membresia={proxima} titulo="Próxima membresía" />
          {accionesAdmin(proxima)}
        </>
      )}

      {!actual && (
        <div className="acciones acciones-izquierda">
          {renovable && clienteActivo && <Button onClick={() => setRenovando(renovable)}>Renovar</Button>}
          {puedeAsignar && (
            <Button variante={renovable ? 'secundario' : 'primario'} onClick={() => setAsignando(true)}>
              Asignar membresía
            </Button>
          )}
        </div>
      )}

      <h3 className="subtitulo-panel">Historial</h3>
      <Table
        etiquetaTabla="Historial de membresías"
        columnas={columnas}
        filas={historial.map((m) => ({ ...m, id: m.id_membresia }))}
        vacio={<p className="texto-suave">Sin membresías anteriores.</p>}
      />

      {asignando && <AsignarMembresia idCliente={idCliente} onCerrar={cerrarAsignar} onGuardado={alGuardar('Membresía asignada.')} />}
      {pagando && <RegistrarPago membresia={pagando} onCerrar={cerrarPago} onGuardado={alGuardar('Pago registrado.')} />}
      {renovando && <RenovarMembresia membresia={renovando} onCerrar={cerrarRenovar} onGuardado={alGuardar('Membresía renovada.')} />}

      <ConfirmDialog
        abierto={Boolean(confirmacion)}
        titulo={confirmacion ? TEXTO_ACCION[confirmacion.accion].titulo : ''}
        texto={confirmacion ? TEXTO_ACCION[confirmacion.accion].texto : ''}
        textoConfirmar={confirmacion ? TEXTO_ACCION[confirmacion.accion].confirmar : 'Confirmar'}
        onConfirmar={confirmarAccion}
        onCancelar={cancelarConfirmacion}
      />
    </Card>
  );
}
