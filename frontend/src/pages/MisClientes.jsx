import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Table from '../components/ui/Table.jsx';
import { formatearFechaCorta } from '../utils/formato.js';

const LIMITE = 20;

// "Mis clientes" del entrenador (spec 004, US7): sus clientes asignados activos, con enlace a su entrenamiento.
export default function MisClientes() {
  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const parametros = new URLSearchParams({ page: String(numeroPagina), limit: String(LIMITE) });
    if (busqueda) parametros.set('q', busqueda);
    try {
      setPagina(await solicitar(`/entrenamiento/mis-clientes?${parametros}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la lista de tus clientes.');
    } finally {
      setCargando(false);
    }
  }, [numeroPagina, busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const columnas = [
    { clave: 'nombre', etiqueta: 'Cliente', render: (c) => <Link to={`/clientes/${c.id_cliente}`}>{`${c.nombre} ${c.apellido}`}</Link> },
    { clave: 'desde', etiqueta: 'Asignado desde', render: (c) => formatearFechaCorta(c.desde) },
  ];

  return (
    <section>
      <PageHeader titulo="Mis clientes" descripcion={`Clientes asignados a ti: ${pagina.total}. Abre uno para ver o registrar su rutina y su progreso.`} />
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
        <FormField id="buscar-mis-clientes" etiqueta="Buscar">
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o apellido" maxLength={150} />
        </FormField>
        <div className="filtros-acciones">
          <Button type="submit">Buscar</Button>
        </div>
      </form>
      <Table
        etiquetaTabla="Mis clientes"
        columnas={columnas}
        filas={pagina.data.map((c) => ({ ...c, id: c.id_cliente }))}
        vacio={
          cargando ? (
            <div className="estado-vacio">
              <Spinner etiqueta="Cargando tus clientes…" />
            </div>
          ) : (
            <EmptyState titulo={busqueda ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no tienes clientes asignados.'} texto="Recepción o administración te asignan clientes desde su detalle." />
          )
        }
      />
      <Pagination page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />
    </section>
  );
}
