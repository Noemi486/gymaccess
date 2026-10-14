import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Select from '../components/ui/Select.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Table from '../components/ui/Table.jsx';

const LIMITE = 20;

export const formatearFecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX') : '');

// Lista de clientes para administrador, recepcionista y entrenador.
// El backend decide qué datos llegan según el rol: el entrenador no recibe teléfono, correo ni
// dirección, y aquí simplemente no se muestran esas columnas.
export default function Clientes() {
  const { rol } = useAuth();
  // El buscador del inicio llega aquí con el texto en la URL (/clientes?q=…): se aplica como búsqueda inicial.
  const [parametrosUrl] = useSearchParams();
  const busquedaInicial = (parametrosUrl.get('q') ?? '').trim().slice(0, 150);
  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [texto, setTexto] = useState(busquedaInicial); // lo que se escribe
  const [busqueda, setBusqueda] = useState(busquedaInicial); // la búsqueda aplicada
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

  const columnas = [
    { clave: 'nombre', etiqueta: 'Nombre' },
    { clave: 'apellido', etiqueta: 'Apellido' },
    ...(veContacto
      ? [
          { clave: 'telefono', etiqueta: 'Teléfono' },
          { clave: 'correo', etiqueta: 'Correo', render: (cliente) => cliente.correo ?? '—' },
        ]
      : []),
    { clave: 'estado', etiqueta: 'Estado', render: (cliente) => <Badge estado={cliente.estado} /> },
    {
      clave: 'fecha_registro',
      etiqueta: 'Fecha de registro',
      render: (cliente) => formatearFecha(cliente.fecha_registro),
    },
    {
      clave: 'acciones',
      etiqueta: 'Acciones',
      render: (cliente) => (
        <div className="acciones acciones-fila">
          <Button to={`/clientes/${cliente.id_cliente}`} variante="secundario">
            Ver
          </Button>
          {puedeEscribir && (
            <Button to={`/clientes/${cliente.id_cliente}/editar`} variante="secundario">
              Editar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        titulo="Clientes"
        descripcion="Consulta y administra a los clientes del gimnasio."
        acciones={
          puedeEscribir ? (
            <Button to="/clientes/nuevo" icono={<Plus size={18} aria-hidden="true" />}>
              Nuevo cliente
            </Button>
          ) : null
        }
      />

      {error && (
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={buscar} className="filtros">
        <FormField id="busqueda" etiqueta="Buscar">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={veContacto ? 'Nombre, apellido o correo' : 'Nombre o apellido'}
            maxLength={150}
          />
        </FormField>
        <div className="filtros-acciones">
          <Button type="submit">Buscar</Button>
          {busqueda && (
            <Button variante="secundario" onClick={limpiar}>
              Limpiar
            </Button>
          )}
        </div>
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
      </form>

      <Table
        etiquetaTabla="Clientes"
        columnas={columnas}
        filas={pagina.data.map((cliente) => ({ ...cliente, id: cliente.id_cliente }))}
        vacio={
          cargando ? (
            <div className="estado-vacio">
              <Spinner etiqueta="Cargando clientes…" />
            </div>
          ) : (
            <EmptyState
              titulo="No hay clientes con esos criterios."
              texto="Cambia la búsqueda o el filtro de estado."
            />
          )
        }
      />

      <Pagination page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />
    </section>
  );
}
