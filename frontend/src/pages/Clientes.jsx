import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import Mensaje from '../components/Mensaje.jsx';
import Paginacion from '../components/Paginacion.jsx';

const LIMITE = 20;

export const formatearFecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX') : '');

export function InsigniaEstado({ estado }) {
  return <span className={`insignia insignia-${estado}`}>{estado === 'activo' ? 'Activo' : 'Inactivo'}</span>;
}

// Lista de clientes para administrador, recepcionista y entrenador.
// El backend decide qué datos llegan según el rol: el entrenador no recibe teléfono, correo ni
// dirección, y aquí simplemente no se muestran esas columnas.
export default function Clientes() {
  const { rol } = useAuth();
  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [texto, setTexto] = useState(''); // lo que se escribe
  const [busqueda, setBusqueda] = useState(''); // la búsqueda aplicada
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const veContacto = rol === 'administrador' || rol === 'recepcionista';
  const puedeEscribir = veContacto; // registrar y editar: administrador y recepcionista

  const cargar = useCallback(async () => {
    setCargando(true);
    const parametros = new URLSearchParams({ page: String(numeroPagina), limit: String(LIMITE) });
    if (busqueda) parametros.set('q', busqueda);
    if (filtroEstado) parametros.set('estado', filtroEstado);
    try {
      setPagina(await solicitar(`/clientes?${parametros}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la lista de clientes.');
    } finally {
      setCargando(false);
    }
  }, [numeroPagina, busqueda, filtroEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function buscar(evento) {
    evento.preventDefault();
    setBusqueda(texto.trim());
    setNumeroPagina(1);
  }

  function limpiar() {
    setTexto('');
    setBusqueda('');
    setNumeroPagina(1);
  }

  const columnas = veContacto ? 7 : 5;

  return (
    <section>
      <div className="acciones" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Clientes</h1>
        {puedeEscribir && (
          <Link to="/clientes/nuevo" className="boton">
            Nuevo cliente
          </Link>
        )}
      </div>

      <Mensaje tipo="error" texto={error} />

      <form onSubmit={buscar} className="acciones" style={{ justifyContent: 'flex-start', alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="campo" style={{ marginBottom: 0 }}>
          <label htmlFor="busqueda">Buscar</label>
          <input
            id="busqueda"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={veContacto ? 'Nombre, apellido o correo' : 'Nombre o apellido'}
            maxLength={150}
          />
        </div>
        <button type="submit" className="boton">
          Buscar
        </button>
        {busqueda && (
          <button type="button" className="boton boton-secundario" onClick={limpiar}>
            Limpiar
          </button>
        )}
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
      </form>

      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Apellido</th>
              {veContacto && <th>Teléfono</th>}
              {veContacto && <th>Correo</th>}
              <th>Estado</th>
              <th>Fecha de registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pagina.data.map((cliente) => (
              <tr key={cliente.id_cliente}>
                <td>{cliente.nombre}</td>
                <td>{cliente.apellido}</td>
                {veContacto && <td>{cliente.telefono}</td>}
                {veContacto && <td>{cliente.correo ?? '—'}</td>}
                <td>
                  <InsigniaEstado estado={cliente.estado} />
                </td>
                <td>{formatearFecha(cliente.fecha_registro)}</td>
                <td>
                  <div className="acciones" style={{ justifyContent: 'flex-start' }}>
                    <Link to={`/clientes/${cliente.id_cliente}`} className="boton boton-secundario">
                      Ver
                    </Link>
                    {puedeEscribir && (
                      <Link to={`/clientes/${cliente.id_cliente}/editar`} className="boton boton-secundario">
                        Editar
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!cargando && pagina.data.length === 0 && (
              <tr>
                <td colSpan={columnas}>No hay clientes con esos criterios.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Paginacion page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />
    </section>
  );
}
