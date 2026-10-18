import { useCallback, useEffect, useState } from 'react';
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
import { formatearFechaCorta } from '../utils/formato.js';

const LIMITE = 20;
const ROLES_CON_DETALLE = ['administrador', 'recepcionista'];

// "10:00:00" -> "10:00"
const formatearHora = (hora) => String(hora ?? '').slice(0, 5);

// Consulta de accesos para administrador, recepcionista y entrenador. Es solo lectura: un acceso es un
// registro y no se edita ni se elimina. El backend decide qué datos llegan según el rol: el entrenador recibe
// únicamente nombre, fecha, hora y resultado, y aquí simplemente no se muestran el tipo ni el motivo.
export default function Accesos() {
  const { rol } = useAuth();
  const veDetalle = ROLES_CON_DETALLE.includes(rol);
  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resultado, setResultado] = useState('');
  const [texto, setTexto] = useState(''); // lo que se escribe
  const [busqueda, setBusqueda] = useState(''); // la búsqueda aplicada
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const rangoInvertido = Boolean(desde && hasta && desde > hasta);

  const cargar = useCallback(async () => {
    if (rangoInvertido) return;
    setCargando(true);
    const parametros = new URLSearchParams({ page: String(numeroPagina), limit: String(LIMITE) });
    if (desde) parametros.set('desde', desde);
    if (hasta) parametros.set('hasta', hasta);
    if (resultado) parametros.set('resultado', resultado);
    if (busqueda) parametros.set('q', busqueda);
    try {
      setPagina(await solicitar(`/accesos?${parametros}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la lista de accesos.');
    } finally {
      setCargando(false);
    }
  }, [numeroPagina, desde, hasta, resultado, busqueda, rangoInvertido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarFiltro = (poner) => (evento) => {
    poner(evento.target.value);
    setNumeroPagina(1);
  };

  function buscar(evento) {
    evento.preventDefault();
    setBusqueda(texto.trim());
    setNumeroPagina(1);
  }

  function limpiar() {
    setDesde('');
    setHasta('');
    setResultado('');
    setTexto('');
    setBusqueda('');
    setNumeroPagina(1);
  }

  const hayFiltros = Boolean(desde || hasta || resultado || busqueda);

  const columnas = [
    {
      clave: 'fecha',
      etiqueta: 'Fecha y hora',
      render: (acceso) => `${formatearFechaCorta(acceso.fecha)} · ${formatearHora(acceso.hora)}`,
    },
    {
      clave: 'cliente',
      etiqueta: 'Cliente',
      render: (acceso) => (acceso.cliente ? `${acceso.cliente.nombre} ${acceso.cliente.apellido}` : 'No identificado'),
    },
    ...(veDetalle ? [{ clave: 'tipo', etiqueta: 'Tipo', render: (acceso) => (acceso.tipo === 'salida' ? 'Salida' : 'Entrada') }] : []),
    { clave: 'resultado', etiqueta: 'Resultado', render: (acceso) => <Badge estado={acceso.resultado} /> },
    ...(veDetalle ? [{ clave: 'motivo_rechazo', etiqueta: 'Motivo', render: (acceso) => acceso.motivo_rechazo ?? '—' }] : []),
  ];

  return (
    <section>
      <PageHeader titulo="Accesos" descripcion="Consulta las entradas autorizadas y los rechazos registrados en la entrada del gimnasio." />

      {error && (
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      )}
      {rangoInvertido && (
        <div className="mensaje mensaje-error" role="alert">
          La fecha final no puede ser anterior a la inicial.
        </div>
      )}

      <form onSubmit={buscar} className="filtros">
        <FormField id="filtro-desde" etiqueta="Desde">
          <Input type="date" value={desde} onChange={cambiarFiltro(setDesde)} max={hasta || undefined} />
        </FormField>
        <FormField id="filtro-hasta" etiqueta="Hasta">
          <Input type="date" value={hasta} onChange={cambiarFiltro(setHasta)} min={desde || undefined} />
        </FormField>
        <FormField id="filtro-resultado" etiqueta="Resultado">
          <Select value={resultado} onChange={cambiarFiltro(setResultado)}>
            <option value="">Todos</option>
            <option value="autorizado">Autorizado</option>
            <option value="rechazado">Rechazado</option>
          </Select>
        </FormField>
        <FormField id="busqueda" etiqueta="Cliente">
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o apellido" maxLength={150} />
        </FormField>
        <div className="filtros-acciones">
          <Button type="submit">Buscar</Button>
          {hayFiltros && (
            <Button variante="secundario" onClick={limpiar}>
              Limpiar
            </Button>
          )}
        </div>
      </form>

      <Table
        etiquetaTabla="Accesos"
        columnas={columnas}
        filas={pagina.data.map((acceso) => ({ ...acceso, id: acceso.id_acceso }))}
        vacio={
          cargando ? (
            <div className="estado-vacio">
              <Spinner etiqueta="Cargando accesos…" />
            </div>
          ) : (
            <EmptyState
              titulo={hayFiltros ? 'No hay accesos con esos criterios.' : 'Todavía no hay accesos registrados.'}
              texto={hayFiltros ? 'Cambia las fechas, el resultado o la búsqueda.' : 'Aparecerán aquí cuando alguien use la estación de acceso.'}
            />
          )
        }
      />

      <Pagination page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />
    </section>
  );
}
