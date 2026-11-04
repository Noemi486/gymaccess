import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { formatearFechaCorta } from '../utils/formato.js';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import Card from './ui/Card.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import FormField from './ui/FormField.jsx';
import Select from './ui/Select.jsx';
import Spinner from './ui/Spinner.jsx';
import { useToast } from './ui/Toast.jsx';

// Entrenador del cliente en su detalle (spec 004, US2): actual, asignar, cambiar, quitar e historial.
// Solo administrador y recepcionista; el servidor vuelve a validar el permiso.
export default function PanelEntrenador({ cliente }) {
  const { mostrar } = useToast();
  const clienteActivo = cliente.estado === 'activo';
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [editando, setEditando] = useState(false);
  const [opciones, setOpciones] = useState(null);
  const [elegido, setElegido] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(null); // 'cambiar' | 'quitar'

  const cargar = useCallback(async () => {
    try {
      setDatos(await solicitar(`/clientes/${cliente.id_cliente}/entrenador`));
      setErrorCarga(false);
    } catch {
      setErrorCarga(true);
    } finally {
      setCargando(false);
    }
  }, [cliente.id_cliente]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function abrirEdicion() {
    setError(null);
    setElegido('');
    setEditando(true);
    if (opciones) return;
    try {
      const pagina = await solicitar('/entrenadores?estado=activo&limit=100');
      setOpciones(pagina.data);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la lista de entrenadores.');
    }
  }

  async function guardar(idEntrenador) {
    setError(null);
    setEnviando(true);
    try {
      setDatos(await solicitar(`/clientes/${cliente.id_cliente}/entrenador`, { metodo: 'PUT', cuerpo: { id_entrenador: idEntrenador } }));
      setEditando(false);
      mostrar({ tipo: 'exito', texto: idEntrenador === null ? 'Se quitó el entrenador.' : 'Entrenador asignado.' });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.mensajeDeCampo('id_entrenador') ?? e.message : 'No se pudo guardar el cambio.');
    } finally {
      setEnviando(false);
    }
  }

  function alEnviar(evento) {
    evento.preventDefault();
    if (!elegido) {
      setError('Elige un entrenador.');
      return;
    }
    if (datos?.actual) setConfirmar('cambiar');
    else guardar(Number(elegido));
  }

  const cancelarConfirmacion = useCallback(() => setConfirmar(null), []);

  if (cargando) return <Spinner etiqueta="Cargando entrenador…" />;
  if (errorCarga || !datos) {
    return (
      <Card titulo="Entrenador">
        <p className="texto-suave">No se pudo cargar el entrenador del cliente.</p>
      </Card>
    );
  }

  const { actual, historial } = datos;
  const nombreElegido = opciones?.find((o) => String(o.id_usuario) === elegido)?.nombre;

  return (
    <Card titulo="Entrenador" className="panel-entrenador">
      {actual ? (
        <p>
          <Link to={`/entrenadores/${actual.entrenador.id_usuario}`}>{actual.entrenador.nombre}</Link>
          <span className="texto-suave"> · desde {formatearFechaCorta(actual.fecha_inicio)}</span>
        </p>
      ) : (
        <p>Sin entrenador asignado.</p>
      )}

      {error && !editando && (
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      )}

      {editando ? (
        <form onSubmit={alEnviar} noValidate>
          <FormField id="elegir-entrenador" etiqueta={actual ? 'Nuevo entrenador' : 'Entrenador'} error={error ?? undefined}>
            <Select value={elegido} onChange={(e) => setElegido(e.target.value)} disabled={!opciones}>
              <option value="">— Elige un entrenador —</option>
              {(opciones ?? [])
                .filter((o) => o.id_usuario !== actual?.entrenador.id_usuario)
                .map((o) => (
                  <option key={o.id_usuario} value={String(o.id_usuario)}>
                    {o.nombre}
                    {o.especialidad ? ` (${o.especialidad})` : ''} · {o.clientes_asignados} clientes
                  </option>
                ))}
            </Select>
          </FormField>
          <div className="acciones acciones-izquierda">
            <Button type="submit" cargando={enviando}>
              Guardar
            </Button>
            <Button variante="secundario" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        clienteActivo && (
          <div className="acciones acciones-izquierda">
            <Button onClick={abrirEdicion}>{actual ? 'Cambiar entrenador' : 'Asignar entrenador'}</Button>
            {actual && (
              <Button variante="secundario" onClick={() => setConfirmar('quitar')}>
                Quitar entrenador
              </Button>
            )}
          </div>
        )
      )}

      {historial.length > 0 && (
        <>
          <h3 className="subtitulo-panel">Historial de entrenadores</h3>
          <ul className="lista-historial" aria-label="Historial de entrenadores">
            {historial.map((h) => (
              <li key={h.id_asignacion}>
                <span>{h.entrenador.nombre}</span>
                <span className="texto-suave">
                  {formatearFechaCorta(h.fecha_inicio)} – {h.fecha_fin ? formatearFechaCorta(h.fecha_fin) : 'hoy'}
                </span>
                {h.estado === 'activa' ? <Badge variante="exito">Actual</Badge> : <Badge variante="neutral">Terminada</Badge>}
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        abierto={Boolean(confirmar)}
        titulo={confirmar === 'quitar' ? 'Quitar entrenador' : 'Cambiar entrenador'}
        texto={
          confirmar === 'quitar'
            ? `${cliente.nombre} quedará sin entrenador. Su rutina y su progreso se conservan.`
            : `Se cerrará la asignación con ${actual?.entrenador.nombre ?? ''} y empezará con ${nombreElegido ?? 'el entrenador elegido'}. Su rutina y su progreso se conservan.`
        }
        textoConfirmar={confirmar === 'quitar' ? 'Quitar' : 'Cambiar'}
        onConfirmar={() => {
          const accion = confirmar;
          setConfirmar(null);
          guardar(accion === 'quitar' ? null : Number(elegido));
        }}
        onCancelar={cancelarConfirmacion}
      />
    </Card>
  );
}
