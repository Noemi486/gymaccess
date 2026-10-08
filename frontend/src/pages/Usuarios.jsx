import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Confirmacion from '../components/Confirmacion.jsx';
import Mensaje from '../components/Mensaje.jsx';
import Paginacion from '../components/Paginacion.jsx';

export const ETIQUETAS_ROL = {
  administrador: 'Administrador',
  recepcionista: 'Recepcionista',
  entrenador: 'Entrenador',
  cliente: 'Cliente',
};

const LIMITE = 20;

// Lista de usuarios (solo administrador): filtros, paginación, activar y desactivar.
export default function Usuarios() {
  const location = useLocation();
  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(location.state?.mensaje ?? null);
  const [pendiente, setPendiente] = useState(null); // usuario que se va a desactivar

  const cargar = useCallback(async () => {
    setCargando(true);
    const parametros = new URLSearchParams({ page: String(numeroPagina), limit: String(LIMITE) });
    if (filtroRol) parametros.set('rol', filtroRol);
    if (filtroEstado) parametros.set('estado', filtroEstado);
    try {
      setPagina(await solicitar(`/usuarios?${parametros}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la lista de usuarios.');
    } finally {
      setCargando(false);
    }
  }, [numeroPagina, filtroRol, filtroEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(usuario, estado) {
    setError(null);
    setExito(null);
    try {
      const actualizado = await solicitar(`/usuarios/${usuario.id_usuario}`, {
        metodo: 'PATCH',
        cuerpo: { estado },
      });
      setPagina((actual) => ({
        ...actual,
        data: actual.data.map((fila) => (fila.id_usuario === actualizado.id_usuario ? actualizado : fila)),
      }));
      setExito(estado === 'activo' ? 'Usuario activado.' : 'Usuario desactivado.');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el estado del usuario.');
    }
  }

  async function confirmarDesactivacion() {
    const usuario = pendiente;
    setPendiente(null);
    await cambiarEstado(usuario, 'inactivo');
  }

  return (
    <section>
      <div className="acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Usuarios y roles</h1>
        <Link to="/usuarios/nuevo" className="boton">
          Nuevo usuario
        </Link>
      </div>

      <Mensaje tipo="exito" texto={exito} />
      <Mensaje tipo="error" texto={error} />

      <div className="acciones" style={{ justifyContent: 'flex-start', marginBottom: 16 }}>
        <div className="campo" style={{ marginBottom: 0 }}>
          <label htmlFor="filtro-rol">Rol</label>
          <select
            id="filtro-rol"
            value={filtroRol}
            onChange={(e) => {
              setFiltroRol(e.target.value);
              setNumeroPagina(1);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(ETIQUETAS_ROL).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ marginBottom: 0 }}>
          <label htmlFor="filtro-estado">Estado</label>
          <select
            id="filtro-estado"
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value);
              setNumeroPagina(1);
            }}
          >
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
      </div>

      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagina.data.map((usuario) => (
              <tr key={usuario.id_usuario}>
                <td>{usuario.nombre}</td>
                <td>{usuario.correo}</td>
                <td>{ETIQUETAS_ROL[usuario.rol] ?? usuario.rol}</td>
                <td>
                  <span className={`insignia insignia-${usuario.estado}`}>
                    {usuario.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="acciones" style={{ justifyContent: 'flex-start' }}>
                    <Link to={`/usuarios/${usuario.id_usuario}/editar`} className="boton boton-secundario">
                      Editar
                    </Link>
                    {usuario.estado === 'activo' ? (
                      <button type="button" className="boton boton-secundario" onClick={() => setPendiente(usuario)}>
                        Desactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="boton boton-secundario"
                        onClick={() => cambiarEstado(usuario, 'activo')}
                      >
                        Activar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!cargando && pagina.data.length === 0 && (
              <tr>
                <td colSpan={5}>No hay usuarios con esos filtros.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Paginacion page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />

      <Confirmacion
        abierto={Boolean(pendiente)}
        titulo="Desactivar usuario"
        texto={
          pendiente
            ? `Se desactivará la cuenta de ${pendiente.nombre} (${pendiente.correo}). No podrá iniciar sesión, pero su registro se conserva y se puede reactivar.`
            : ''
        }
        textoConfirmar="Desactivar"
        onConfirmar={confirmarDesactivacion}
        onCancelar={() => setPendiente(null)}
      />
    </section>
  );
}
