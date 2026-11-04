import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import ElegirAdeudo from '../components/ElegirAdeudo.jsx';
import RegistrarPago from '../components/RegistrarPago.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Select from '../components/ui/Select.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Table from '../components/ui/Table.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatearFechaHora, formatearMoneda } from '../utils/formato.js';

const LIMITE = 20;
const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

// Historial de pagos (solo lectura: un pago no se edita ni se elimina), con el total de lo filtrado
// y un botón para cobrar una membresía pendiente.
export default function Pagos() {
  const { mostrar } = useToast();
  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0, total_monto: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [metodo, setMetodo] = useState('');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [cobrando, setCobrando] = useState(null);

  const rangoInvertido = Boolean(desde && hasta && desde > hasta);

  const cargar = useCallback(async () => {
    if (rangoInvertido) return;
    setCargando(true);
    const parametros = new URLSearchParams({ page: String(numeroPagina), limit: String(LIMITE) });
    if (desde) parametros.set('desde', desde);
    if (hasta) parametros.set('hasta', hasta);
    if (metodo) parametros.set('metodo_pago', metodo);
    if (busqueda) parametros.set('q', busqueda);
    try {
      setPagina(await solicitar(`/pagos?${parametros}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el historial de pagos.');
    } finally {
      setCargando(false);
    }
  }, [numeroPagina, desde, hasta, metodo, busqueda, rangoInvertido]);

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
    setMetodo('');
    setTexto('');
    setBusqueda('');
    setNumeroPagina(1);
  }

  function alPagar() {
    setCobrando(null);
    mostrar({ tipo: 'exito', texto: 'Pago registrado.' });
    cargar();
  }

  const hayFiltros = Boolean(desde || hasta || metodo || busqueda);

  const columnas = [
    { clave: 'fecha_pago', etiqueta: 'Fecha', render: (p) => formatearFechaHora(p.fecha_pago) },
    {
      clave: 'cliente',
      etiqueta: 'Cliente',
      render: (p) => <Link to={`/clientes/${p.cliente.id_cliente}`}>{`${p.cliente.nombre} ${p.cliente.apellido}`}</Link>,
    },
    { clave: 'plan', etiqueta: 'Membresía', render: (p) => p.membresia.plan },
    { clave: 'monto', etiqueta: 'Monto', render: (p) => formatearMoneda(p.monto) },
    { clave: 'metodo_pago', etiqueta: 'Método', render: (p) => METODOS[p.metodo_pago] ?? p.metodo_pago },
    { clave: 'registrado_por', etiqueta: 'Registró', render: (p) => p.registrado_por ?? '—' },
  ];

  return (
    <section>
      <PageHeader
        titulo="Pagos"
        descripcion="Historial de pagos registrados. Los pagos no se editan ni se eliminan."
        acciones={<Button onClick={() => setEligiendo(true)}>Registrar pago</Button>}
      />

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
        <FormField id="pagos-desde" etiqueta="Desde">
          <Input type="date" value={desde} onChange={cambiarFiltro(setDesde)} max={hasta || undefined} />
        </FormField>
        <FormField id="pagos-hasta" etiqueta="Hasta">
          <Input type="date" value={hasta} onChange={cambiarFiltro(setHasta)} min={desde || undefined} />
        </FormField>
        <FormField id="pagos-metodo" etiqueta="Método">
          <Select value={metodo} onChange={cambiarFiltro(setMetodo)}>
            <option value="">Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
          </Select>
        </FormField>
        <FormField id="pagos-busqueda" etiqueta="Cliente">
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

      {!cargando && !rangoInvertido && (
        <p className="resumen-lista">
          {pagina.total} {pagina.total === 1 ? 'pago' : 'pagos'} · Total: <strong>{formatearMoneda(pagina.total_monto ?? 0)}</strong>
        </p>
      )}

      <Table
        etiquetaTabla="Pagos"
        columnas={columnas}
        filas={pagina.data.map((p) => ({ ...p, id: p.id_pago }))}
        vacio={
          cargando ? (
            <div className="estado-vacio">
              <Spinner etiqueta="Cargando pagos…" />
            </div>
          ) : (
            <EmptyState
              titulo={hayFiltros ? 'No hay pagos con esos criterios.' : 'Todavía no hay pagos registrados.'}
              texto={hayFiltros ? 'Cambia las fechas, el método o la búsqueda.' : 'Aparecerán aquí al cobrar una membresía.'}
            />
          )
        }
      />

      <Pagination page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />

      {eligiendo && (
        <ElegirAdeudo
          onCerrar={() => setEligiendo(false)}
          onElegir={(a) => {
            setEligiendo(false);
            setCobrando(a);
          }}
        />
      )}
      {cobrando && (
        <RegistrarPago
          membresia={{ id_membresia: cobrando.id_membresia, adeudo: cobrando.adeudo, tipo: { nombre: cobrando.plan } }}
          onCerrar={() => setCobrando(null)}
          onGuardado={alPagar}
        />
      )}
    </section>
  );
}
