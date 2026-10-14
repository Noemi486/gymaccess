import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import FormField from '../components/ui/FormField.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Select from '../components/ui/Select.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Table from '../components/ui/Table.jsx';
import { useToast } from '../components/ui/Toast.jsx';

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
  const { mostrar } = useToast();
  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [pendiente, setPendiente] = useState(null); // usuario que se va a desactivar

  // Aviso de éxito que deja el formulario al guardar (se muestra una sola vez al llegar a la lista).
  const mensajeInicial = location.state?.mensaje;
  useEffect(() => {
    if (mensajeInicial) mostrar({ tipo: 'exito', texto: mensajeInicial });
  }, [mensajeInicial, mostrar]);

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
    try {
      const actualizado = await solicitar(`/usuarios/${usuario.id_usuario}`, {
        metodo: 'PATCH',
        cuerpo: { estado },
      });
      setPagina((actual) => ({
        ...actual,
        data: actual.data.map((fila) => (fila.id_usuario === actualizado.id_usuario ? actualizado : fila)),
      }));
      mostrar({ tipo: 'exito', texto: estado === 'activo' ? 'Usuario activado.' : 'Usuario desactivado.' });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el estado del usuario.');
    }
  }

  async function confirmarDesactivacion() {
    const usuario = pendiente;
    setPendiente(null);
    await cambiarEstado(usuario, 'inactivo');
  }

  const cancelarDesactivacion = useCallback(() => setPendiente(null), []);

  const columnas = [
    { clave: 'nombre', etiqueta: 'Nombre' },
    { clave: 'correo', etiqueta: 'Correo' },
    { clave: 'rol', etiqueta: 'Rol', render: (usuario) => ETIQUETAS_ROL[usuario.rol] ?? usuario.rol },
    { clave: 'estado', etiqueta: 'Estado', render: (usuario) => <Badge estado={usuario.estado} /> },
    {
      clave: 'acciones',
      etiqueta: 'Acciones',
      render: (usuario) => (
        <div className="acciones acciones-fila">
          <Button to={`/usuarios/${usuario.id_usuario}/editar`} variante="secundario">
            Editar
          </Button>
          {usuario.estado === 'activo' ? (
            <Button variante="secundario" onClick={() => setPendiente(usuario)}>
              Desactivar
            </Button>
          ) : (
            <Button variante="secundario" onClick={() => cambiarEstado(usuario, 'activo')}>
              Activar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        titulo="Usuarios y roles"
        descripcion="Administra las cuentas del personal y sus roles."
        acciones={
          <Button to="/usuarios/nuevo" icono={<Plus size={18} aria-hidden="true" />}>
            Nuevo usuario
          </Button>
        }
      />

      {error && (
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      )}

      <div className="filtros">
        <FormField id="filtro-rol" etiqueta="Rol">
          <Select
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
          </Select>
        </FormField>
        <FormField id="filtro-estado" etiqueta="Estado">
          <Select
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value);
              setNumeroPagina(1);
            }}
          >
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </Select>
        </FormField>
      </div>

      <Table
        etiquetaTabla="Usuarios"
        columnas={columnas}
        filas={pagina.data.map((usuario) => ({ ...usuario, id: usuario.id_usuario }))}
        vacio={
          cargando ? (
            <div className="estado-vacio">
              <Spinner etiqueta="Cargando usuarios…" />
            </div>
          ) : (
            <EmptyState titulo="No hay usuarios con esos filtros." texto="Prueba con otros filtros o crea un usuario nuevo." />
          )
        }
      />

      <Pagination page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />

      <ConfirmDialog
        abierto={Boolean(pendiente)}
        titulo="Desactivar usuario"
        texto={
          pendiente
            ? `Se desactivará la cuenta de ${pendiente.nombre} (${pendiente.correo}). No podrá iniciar sesión, pero su registro se conserva y se puede reactivar.`
            : ''
        }
        textoConfirmar="Desactivar"
        onConfirmar={confirmarDesactivacion}
        onCancelar={cancelarDesactivacion}
      />
    </section>
  );
}
