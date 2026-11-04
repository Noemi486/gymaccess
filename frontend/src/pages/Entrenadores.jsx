import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Select from '../components/ui/Select.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Table from '../components/ui/Table.jsx';
import { useToast } from '../components/ui/Toast.jsx';

const LIMITE = 20;

// Entrenadores (spec 004, US1 y US7): el administrador los gestiona; el recepcionista los consulta
// junto con su número de clientes asignados.
export default function Entrenadores() {
  const { rol } = useAuth();
  const esAdmin = rol === 'administrador';
  const location = useLocation();
  const { mostrar } = useToast();
  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [pendiente, setPendiente] = useState(null);

  const mensajeInicial = location.state?.mensaje;
  useEffect(() => {
    if (mensajeInicial) mostrar({ tipo: 'exito', texto: mensajeInicial });
  }, [mensajeInicial, mostrar]);

  const cargar = useCallback(async () => {
    setCargando(true);
    const parametros = new URLSearchParams({ page: String(numeroPagina), limit: String(LIMITE) });
    if (busqueda) parametros.set('q', busqueda);
    if (filtroEstado) parametros.set('estado', filtroEstado);
    try {
      setPagina(await solicitar(`/entrenadores?${parametros}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la lista de entrenadores.');
    } finally {
      setCargando(false);
    }
  }, [numeroPagina, busqueda, filtroEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(entrenador, estado) {
    setError(null);
    try {
      const actualizado = await solicitar(`/entrenadores/${entrenador.id_usuario}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
      setPagina((actual) => ({
        ...actual,
        data: actual.data.map((fila) => (fila.id_usuario === actualizado.id_usuario ? { ...fila, ...actualizado } : fila)),
      }));
      mostrar({ tipo: 'exito', texto: estado === 'activo' ? 'Entrenador activado.' : 'Entrenador desactivado.' });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el estado del entrenador.');
    }
  }

  const cancelar = useCallback(() => setPendiente(null), []);

  const columnas = [
    {
      clave: 'nombre',
      etiqueta: 'Nombre',
      render: (e) => <Link to={`/entrenadores/${e.id_usuario}`}>{e.nombre}</Link>,
    },
    { clave: 'correo', etiqueta: 'Correo' },
    { clave: 'especialidad', etiqueta: 'Especialidad', render: (e) => e.especialidad ?? 'Sin capturar' },
    { clave: 'clientes_asignados', etiqueta: 'Clientes asignados' },
    { clave: 'estado', etiqueta: 'Estado', render: (e) => <Badge estado={e.estado} /> },
  ];
  if (esAdmin) {
    columnas.push({
      clave: 'acciones',
      etiqueta: 'Acciones',
      render: (e) => (
        <div className="acciones acciones-fila">
          <Button to={`/entrenadores/${e.id_usuario}/editar`} variante="secundario">
            Editar
          </Button>
          {e.estado === 'activo' ? (
            <Button variante="secundario" onClick={() => setPendiente(e)}>
              Desactivar
            </Button>
          ) : (
            <Button variante="secundario" onClick={() => cambiarEstado(e, 'activo')}>
              Activar
            </Button>
          )}
        </div>
      ),
    });
  }

  return (
    <section>
      <PageHeader
        titulo="Entrenadores"
        descripcion={esAdmin ? 'Registra a los entrenadores y revisa su carga de clientes.' : 'Consulta a los entrenadores y sus clientes asignados.'}
        acciones={
          esAdmin ? (
            <Button to="/entrenadores/nuevo" icono={<Plus size={18} aria-hidden="true" />}>
              Nuevo entrenador
            </Button>
          ) : null
        }
      />

      {error && (
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      )}

      <form
        className="filtros"
        onSubmit={(e) => {
          e.preventDefault();
          setBusqueda(texto.trim());
          setNumeroPagina(1);
        }}
      >
        <FormField id="busqueda-entrenador" etiqueta="Buscar">
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, correo o especialidad" maxLength={150} />
        </FormField>
        <FormField id="filtro-estado-entrenador" etiqueta="Estado">
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
        <div className="filtros-acciones">
          <Button type="submit">Buscar</Button>
        </div>
      </form>

      <Table
        etiquetaTabla="Entrenadores"
        columnas={columnas}
        filas={pagina.data.map((e) => ({ ...e, id: e.id_usuario }))}
        vacio={
          cargando ? (
            <div className="estado-vacio">
              <Spinner etiqueta="Cargando entrenadores…" />
            </div>
          ) : (
            <EmptyState titulo="No hay entrenadores con esos filtros." texto={esAdmin ? 'Registra al primero con "Nuevo entrenador".' : 'Prueba con otra búsqueda.'} />
          )
        }
      />

      <Pagination page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />

      <ConfirmDialog
        abierto={Boolean(pendiente)}
        titulo="Desactivar entrenador"
        texto={pendiente ? `Se desactivará la cuenta de ${pendiente.nombre}. No podrá iniciar sesión ni recibir clientes; se puede reactivar.` : ''}
        textoConfirmar="Desactivar"
        onConfirmar={async () => {
          const e = pendiente;
          setPendiente(null);
          await cambiarEstado(e, 'inactivo');
        }}
        onCancelar={cancelar}
      />
    </section>
  );
}
