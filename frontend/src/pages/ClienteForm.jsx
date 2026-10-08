import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import Confirmacion from '../components/Confirmacion.jsx';
import Mensaje from '../components/Mensaje.jsx';

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
  const [valores, setValores] = useState(VACIO);
  const [original, setOriginal] = useState(null);
  const [cargando, setCargando] = useState(editando);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
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
    setExito(null);

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
        setExito('Cliente actualizado.');
      } else {
        setValores(VACIO);
        setExito('Cliente registrado.');
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
    setExito(null);
    try {
      const actualizado = await solicitar(`/clientes/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
      setOriginal(actualizado);
      setExito(estado === 'inactivo' ? 'Cliente dado de baja.' : 'Cliente reactivado.');
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo cambiar el estado del cliente.'));
    }
  }

  // El mensaje general se muestra si no hay detalles o si algún detalle no corresponde a un campo visible.
  const detalles = error?.detalles ?? [];
  const hayDetallesSinCampo = detalles.some((d) => !CAMPOS_DEL_FORMULARIO.includes(d.field));
  const mostrarGeneral = error && (detalles.length === 0 || hayDetallesSinCampo);
  const errorDe = (campo) => error?.mensajeDeCampo(campo);

  if (cargando) return <p>Cargando…</p>;
  if (editando && !original) {
    return (
      <section>
        <Mensaje tipo="error" texto={error?.message ?? 'El cliente no existe.'} />
        <Link to="/clientes">Volver a la lista</Link>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 520 }}>
      <h1>{editando ? 'Editar cliente' : 'Registrar cliente'}</h1>

      <Mensaje tipo="exito" texto={exito} />
      {mostrarGeneral && <Mensaje tipo="error" texto={error.message} />}

      {editando && (
        <p>
          Estado:{' '}
          <span className={`insignia insignia-${original.estado}`}>
            {original.estado === 'activo' ? 'Activo' : 'Inactivo'}
          </span>
        </p>
      )}

      <form onSubmit={alEnviar} noValidate className="tarjeta">
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" value={valores.nombre} onChange={cambiar('nombre')} maxLength={80} required />
          {errorDe('nombre') && <span className="error-campo">{errorDe('nombre')}</span>}
        </div>

        <div className="campo">
          <label htmlFor="apellido">Apellido</label>
          <input id="apellido" value={valores.apellido} onChange={cambiar('apellido')} maxLength={80} required />
          {errorDe('apellido') && <span className="error-campo">{errorDe('apellido')}</span>}
        </div>

        <div className="campo">
          <label htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            type="tel"
            value={valores.telefono}
            onChange={cambiar('telefono')}
            maxLength={20}
            required
          />
          {errorDe('telefono') && <span className="error-campo">{errorDe('telefono')}</span>}
        </div>

        <div className="campo">
          <label htmlFor="correo">Correo (opcional)</label>
          <input id="correo" type="email" value={valores.correo} onChange={cambiar('correo')} maxLength={150} />
          <span className="ayuda">Necesario solo si el cliente tendrá cuenta de acceso. No puede repetirse.</span>
          {errorDe('correo') && <span className="error-campo">{errorDe('correo')}</span>}
        </div>

        <div className="campo">
          <label htmlFor="direccion">Dirección (opcional)</label>
          <input id="direccion" value={valores.direccion} onChange={cambiar('direccion')} maxLength={255} />
          {errorDe('direccion') && <span className="error-campo">{errorDe('direccion')}</span>}
        </div>

        <div className="acciones">
          <Link to="/clientes" className="boton boton-secundario">
            Volver a la lista
          </Link>
          <button type="submit" className="boton" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>

      {editando && rol === 'administrador' && (
        <div className="acciones" style={{ marginTop: 16 }}>
          {original.estado === 'activo' ? (
            <button type="button" className="boton boton-peligro" onClick={() => setConfirmandoBaja(true)}>
              Dar de baja
            </button>
          ) : (
            <button type="button" className="boton boton-secundario" onClick={() => cambiarEstado('activo')}>
              Reactivar
            </button>
          )}
        </div>
      )}

      <Confirmacion
        abierto={confirmandoBaja}
        titulo="Dar de baja al cliente"
        texto={
          original
            ? `${original.nombre} ${original.apellido} quedará inactivo y, si tiene cuenta de acceso, ya no podrá iniciar sesión. Su registro se conserva y se puede reactivar.`
            : ''
        }
        textoConfirmar="Dar de baja"
        onConfirmar={() => cambiarEstado('inactivo')}
        onCancelar={() => setConfirmandoBaja(false)}
      />
    </section>
  );
}
