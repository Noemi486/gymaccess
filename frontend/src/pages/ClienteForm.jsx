import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useToast } from '../components/ui/Toast.jsx';

const CAMPOS_DEL_FORMULARIO = ['nombre', 'apellido', 'telefono', 'correo', 'direccion'];
const VACIO = { nombre: '', apellido: '', telefono: '', correo: '', direccion: '' };

// Texto de un campo opcional: null si está vacío o en blanco.
const opcional = (texto) => (texto.trim() === '' ? null : texto.trim());

const aValores = (cliente) => ({
  nombre: cliente.nombre,
  apellido: cliente.apellido,
  telefono: cliente.telefono,
  correo: cliente.correo ?? '',
  direccion: cliente.direccion ?? '',
});

// Alta (/clientes/nuevo) y edición (/clientes/:id/editar) de un cliente.
// Nombre, apellido y teléfono son obligatorios; correo y dirección, opcionales.
// Solo el administrador ve el control para dar de baja o reactivar.
export default function ClienteForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const { rol } = useAuth();
  const { mostrar } = useToast();
  const [valores, setValores] = useState(VACIO);
  const [original, setOriginal] = useState(null);
  const [cargando, setCargando] = useState(editando);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  useEffect(() => {
    if (!editando) return undefined;
    let activo = true;
    solicitar(`/clientes/${id}`)
      .then((cliente) => {
        if (!activo) return;
        setOriginal(cliente);
        setValores(aValores(cliente));
      })
      .catch((e) => activo && setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo cargar el cliente.')))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [editando, id]);

  const cambiar = (campo) => (evento) => setValores((actual) => ({ ...actual, [campo]: evento.target.value }));

  async function alEnviar(evento) {
    evento.preventDefault();
    setError(null);

    let cuerpo;
    if (editando) {
      cuerpo = {};
      if (valores.nombre.trim() !== original.nombre) cuerpo.nombre = valores.nombre.trim();
      if (valores.apellido.trim() !== original.apellido) cuerpo.apellido = valores.apellido.trim();
      if (valores.telefono.trim() !== original.telefono) cuerpo.telefono = valores.telefono.trim();
      if (opcional(valores.correo) !== (original.correo ?? null)) cuerpo.correo = opcional(valores.correo);
      if (opcional(valores.direccion) !== (original.direccion ?? null)) cuerpo.direccion = opcional(valores.direccion);
      if (Object.keys(cuerpo).length === 0) {
        setError(new ErrorApi(0, 'SIN_CAMBIOS', 'No hay cambios para guardar.'));
        return;
      }
    } else {
      cuerpo = { nombre: valores.nombre.trim(), apellido: valores.apellido.trim(), telefono: valores.telefono.trim() };
      if (opcional(valores.correo)) cuerpo.correo = opcional(valores.correo);
      if (opcional(valores.direccion)) cuerpo.direccion = opcional(valores.direccion);
    }

    setEnviando(true);
    try {
      const guardado = await solicitar(editando ? `/clientes/${id}` : '/clientes', {
        metodo: editando ? 'PATCH' : 'POST',
        cuerpo,
      });
      if (editando) {
        setOriginal(guardado);
        setValores(aValores(guardado));
        mostrar({ tipo: 'exito', texto: 'Cliente actualizado.' });
      } else {
        setValores(VACIO);
        mostrar({ tipo: 'exito', texto: 'Cliente registrado.' });
      }
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarEstado(estado) {
    setConfirmandoBaja(false);
    setError(null);
    try {
      const actualizado = await solicitar(`/clientes/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
      setOriginal(actualizado);
      mostrar({ tipo: 'exito', texto: estado === 'inactivo' ? 'Cliente dado de baja.' : 'Cliente reactivado.' });
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo cambiar el estado del cliente.'));
    }
  }

  const cancelarBaja = useCallback(() => setConfirmandoBaja(false), []);

  // El mensaje general se muestra si no hay detalles o si algún detalle no corresponde a un campo visible.
  const detalles = error?.detalles ?? [];
  const hayDetallesSinCampo = detalles.some((d) => !CAMPOS_DEL_FORMULARIO.includes(d.field));
  const mostrarGeneral = error && (detalles.length === 0 || hayDetallesSinCampo);
  const errorDe = (campo) => error?.mensajeDeCampo(campo);

  if (cargando) return <Spinner etiqueta="Cargando cliente…" />;
  if (editando && !original) {
    return (
      <section className="formulario-pagina">
        <div className="mensaje mensaje-error" role="alert">
          {error?.message ?? 'El cliente no existe.'}
        </div>
        <Button to="/clientes" variante="secundario">
          Volver a la lista
        </Button>
      </section>
    );
  }

  return (
    <section className="formulario-pagina">
      <PageHeader
        titulo={editando ? 'Editar cliente' : 'Registrar cliente'}
        descripcion={editando ? undefined : 'Nombre, apellido y teléfono son obligatorios.'}
        acciones={editando ? <Badge estado={original.estado} /> : null}
      />

      {mostrarGeneral && (
        <div className="mensaje mensaje-error" role="alert">
          {error.message}
        </div>
      )}

      <form onSubmit={alEnviar} noValidate className="card">
        <FormField id="nombre" etiqueta="Nombre" error={errorDe('nombre')}>
          <Input value={valores.nombre} onChange={cambiar('nombre')} maxLength={80} required />
        </FormField>

        <FormField id="apellido" etiqueta="Apellido" error={errorDe('apellido')}>
          <Input value={valores.apellido} onChange={cambiar('apellido')} maxLength={80} required />
        </FormField>

        <FormField id="telefono" etiqueta="Teléfono" error={errorDe('telefono')}>
          <Input type="tel" value={valores.telefono} onChange={cambiar('telefono')} maxLength={20} required />
        </FormField>

        <FormField
          id="correo"
          etiqueta="Correo (opcional)"
          ayuda="Necesario solo si el cliente tendrá cuenta de acceso. No puede repetirse."
          error={errorDe('correo')}
        >
          <Input type="email" value={valores.correo} onChange={cambiar('correo')} maxLength={150} />
        </FormField>

        <FormField id="direccion" etiqueta="Dirección (opcional)" error={errorDe('direccion')}>
          <Input value={valores.direccion} onChange={cambiar('direccion')} maxLength={255} />
        </FormField>

        <div className="acciones">
          <Button to="/clientes" variante="secundario">
            Volver a la lista
          </Button>
          <Button type="submit" cargando={enviando}>
            Guardar
          </Button>
        </div>
      </form>

      {editando && rol === 'administrador' && (
        <div className="acciones acciones-izquierda">
          {original.estado === 'activo' ? (
            <Button variante="peligro" onClick={() => setConfirmandoBaja(true)}>
              Dar de baja
            </Button>
          ) : (
            <Button variante="secundario" onClick={() => cambiarEstado('activo')}>
              Reactivar
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        abierto={confirmandoBaja}
        titulo="Dar de baja al cliente"
        texto={
          original
            ? `${original.nombre} ${original.apellido} quedará inactivo y, si tiene cuenta de acceso, ya no podrá iniciar sesión. Su registro se conserva y se puede reactivar.`
            : ''
        }
        textoConfirmar="Dar de baja"
        onConfirmar={() => cambiarEstado('inactivo')}
        onCancelar={cancelarBaja}
      />
    </section>
  );
}
