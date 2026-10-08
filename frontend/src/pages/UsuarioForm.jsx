import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Mensaje from '../components/Mensaje.jsx';
import { ETIQUETAS_ROL } from './Usuarios.jsx';

const CAMPOS_DEL_FORMULARIO = ['nombre', 'correo', 'password', 'rol', 'id_cliente'];
const VACIO = { nombre: '', correo: '', password: '', rol: 'recepcionista', id_cliente: '' };

// Alta (/usuarios/nuevo) y edición (/usuarios/:id/editar) de un usuario. Solo administrador.
export default function UsuarioForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const [valores, setValores] = useState(VACIO);
  const [original, setOriginal] = useState(null);
  const [cargando, setCargando] = useState(editando);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  // Selector de cliente (solo al crear una cuenta con rol cliente).
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [opcionesCliente, setOpcionesCliente] = useState([]);
  const [clienteElegido, setClienteElegido] = useState(null);
  const [errorClientes, setErrorClientes] = useState(null);

  const eligiendoCliente = !editando && valores.rol === 'cliente';

  // Busca (con una pequeña espera mientras se escribe) solo clientes disponibles para tener cuenta:
  // activos, con correo y sin cuenta. El administrador es el único que puede pedir esta lista.
  useEffect(() => {
    if (!eligiendoCliente) return undefined;
    let activo = true;
    const espera = setTimeout(() => {
      const parametros = new URLSearchParams({ para_cuenta: 'true', limit: '10' });
      if (busquedaCliente.trim()) parametros.set('q', busquedaCliente.trim());
      solicitar(`/clientes?${parametros}`)
        .then((pagina) => {
          if (!activo) return;
          setOpcionesCliente(pagina.data);
          setErrorClientes(null);
        })
        .catch((e) => activo && setErrorClientes(e instanceof ErrorApi ? e.message : 'No se pudo buscar clientes.'));
    }, 300);
    return () => {
      activo = false;
      clearTimeout(espera);
    };
  }, [eligiendoCliente, busquedaCliente]);

  useEffect(() => {
    if (!editando) return undefined;
    let activo = true;
    solicitar(`/usuarios/${id}`)
      .then((usuario) => {
        if (!activo) return;
        setOriginal(usuario);
        setValores({ ...VACIO, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol });
      })
      .catch((e) => activo && setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo cargar el usuario.')))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [editando, id]);

  const esCuentaDeCliente = original?.rol === 'cliente';
  const cambiar = (campo) => (evento) => setValores((actual) => ({ ...actual, [campo]: evento.target.value }));

  // Al dejar el rol cliente se descarta el cliente elegido y el correo que venía de él.
  function cambiarRol(evento) {
    const rol = evento.target.value;
    setValores((actual) => ({
      ...actual,
      rol,
      id_cliente: '',
      correo: clienteElegido && rol !== 'cliente' ? '' : actual.correo,
    }));
    if (rol !== 'cliente') {
      setClienteElegido(null);
      setBusquedaCliente('');
    }
  }

  // Al elegir un cliente, la cuenta usa su mismo correo (regla FR-011) y sugiere su nombre.
  function elegirCliente(evento) {
    const elegido = opcionesCliente.find((cliente) => String(cliente.id_cliente) === evento.target.value) ?? null;
    setClienteElegido(elegido);
    setValores((actual) => ({
      ...actual,
      id_cliente: elegido ? String(elegido.id_cliente) : '',
      correo: elegido ? elegido.correo : '',
      nombre: elegido && actual.nombre.trim() === '' ? `${elegido.nombre} ${elegido.apellido}` : actual.nombre,
    }));
  }

  async function alEnviar(evento) {
    evento.preventDefault();
    setError(null);

    let cuerpo;
    if (editando) {
      cuerpo = {};
      if (valores.nombre !== original.nombre) cuerpo.nombre = valores.nombre;
      if (!esCuentaDeCliente && valores.correo !== original.correo) cuerpo.correo = valores.correo;
      if (!esCuentaDeCliente && valores.rol !== original.rol) cuerpo.rol = valores.rol;
      if (valores.password) cuerpo.password = valores.password;
      if (Object.keys(cuerpo).length === 0) {
        setError(new ErrorApi(0, 'SIN_CAMBIOS', 'No hay cambios para guardar.'));
        return;
      }
    } else {
      cuerpo = {
        nombre: valores.nombre,
        correo: valores.correo,
        password: valores.password,
        rol: valores.rol,
      };
      if (valores.rol === 'cliente') {
        if (valores.id_cliente === '') {
          setError(
            new ErrorApi(400, 'VALIDATION_ERROR', 'Revisa los datos enviados.', [
              { field: 'id_cliente', message: 'Elige el cliente al que pertenece la cuenta.' },
            ]),
          );
          return;
        }
        cuerpo.id_cliente = Number(valores.id_cliente);
      }
    }

    setEnviando(true);
    try {
      await solicitar(editando ? `/usuarios/${id}` : '/usuarios', {
        metodo: editando ? 'PATCH' : 'POST',
        cuerpo,
      });
      navegar('/usuarios', { state: { mensaje: editando ? 'Usuario actualizado.' : 'Usuario creado.' } });
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
    } finally {
      setEnviando(false);
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
        <Mensaje tipo="error" texto={error?.message ?? 'El usuario no existe.'} />
        <Link to="/usuarios">Volver a la lista</Link>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 520 }}>
      <h1>{editando ? 'Editar usuario' : 'Nuevo usuario'}</h1>
      {mostrarGeneral && <Mensaje tipo="error" texto={error.message} />}

      <form onSubmit={alEnviar} noValidate className="tarjeta">
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" value={valores.nombre} onChange={cambiar('nombre')} maxLength={120} required />
          {errorDe('nombre') && <span className="error-campo">{errorDe('nombre')}</span>}
        </div>

        <div className="campo">
          <label htmlFor="correo">Correo</label>
          <input
            id="correo"
            type="email"
            value={valores.correo}
            onChange={cambiar('correo')}
            disabled={esCuentaDeCliente || eligiendoCliente}
            maxLength={150}
            required
          />
          {(esCuentaDeCliente || eligiendoCliente) && (
            <span className="ayuda">
              {esCuentaDeCliente
                ? 'El correo de una cuenta de cliente es el del cliente y no se cambia aquí.'
                : 'Se toma del cliente que elijas: la cuenta usa su mismo correo.'}
            </span>
          )}
          {errorDe('correo') && <span className="error-campo">{errorDe('correo')}</span>}
        </div>

        <div className="campo">
          <label htmlFor="password">{editando ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={valores.password}
            onChange={cambiar('password')}
            maxLength={72}
            required={!editando}
          />
          <span className="ayuda">
            {editando ? 'Déjala vacía para no cambiarla. ' : ''}De 8 a 72 caracteres, con al menos una letra y un número.
          </span>
          {errorDe('password') && <span className="error-campo">{errorDe('password')}</span>}
        </div>

        <div className="campo">
          <label htmlFor="rol">Rol</label>
          <select id="rol" value={valores.rol} onChange={cambiarRol} disabled={esCuentaDeCliente}>
            {Object.entries(ETIQUETAS_ROL)
              // Un usuario existente no puede pasar al rol cliente: el vínculo se fija al crear la cuenta.
              .filter(([valor]) => !editando || esCuentaDeCliente || valor !== 'cliente')
              .map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
          </select>
          {errorDe('rol') && <span className="error-campo">{errorDe('rol')}</span>}
        </div>

        {eligiendoCliente && (
          <>
            <div className="campo">
              <label htmlFor="buscar-cliente">Buscar cliente</label>
              <input
                id="buscar-cliente"
                type="search"
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                placeholder="Nombre, apellido o correo"
                maxLength={150}
              />
              <span className="ayuda">
                Solo aparecen clientes activos, con correo y que todavía no tienen cuenta.
              </span>
            </div>

            <div className="campo">
              <label htmlFor="id_cliente">Cliente</label>
              <select id="id_cliente" value={valores.id_cliente} onChange={elegirCliente} required>
                <option value="">— Elige un cliente —</option>
                {clienteElegido && !opcionesCliente.some((c) => c.id_cliente === clienteElegido.id_cliente) && (
                  <option value={String(clienteElegido.id_cliente)}>
                    {clienteElegido.nombre} {clienteElegido.apellido} ({clienteElegido.correo})
                  </option>
                )}
                {opcionesCliente.map((cliente) => (
                  <option key={cliente.id_cliente} value={String(cliente.id_cliente)}>
                    {cliente.nombre} {cliente.apellido} ({cliente.correo})
                  </option>
                ))}
              </select>
              {errorClientes && <span className="error-campo">{errorClientes}</span>}
              {errorDe('id_cliente') && <span className="error-campo">{errorDe('id_cliente')}</span>}
            </div>
          </>
        )}

        <div className="acciones">
          <Link to="/usuarios" className="boton boton-secundario">
            Cancelar
          </Link>
          <button type="submit" className="boton" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </section>
  );
}
