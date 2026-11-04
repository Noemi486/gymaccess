import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import RegistrarPago from '../components/RegistrarPago.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Table from '../components/ui/Table.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatearFechaCorta, formatearMoneda } from '../utils/formato.js';

const LIMITE = 20;

// Adeudos: membresías pendientes de pago (sin pago registrado), la fecha de inicio más antigua primero.
// El adeudo es el precio vigente del plan y no se guarda: al registrar el pago, la membresía sale de la lista.
export default function Adeudos() {
  const { mostrar } = useToast();
  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0, total_adeudo: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [cobrando, setCobrando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const parametros = new URLSearchParams({ page: String(numeroPagina), limit: String(LIMITE) });
    if (busqueda) parametros.set('q', busqueda);
    try {
      setPagina(await solicitar(`/adeudos?${parametros}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la lista de adeudos.');
    } finally {
      setCargando(false);
    }
  }, [numeroPagina, busqueda]);

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

  function alPagar() {
    setCobrando(null);
    mostrar({ tipo: 'exito', texto: 'Pago registrado.' });
    cargar();
  }

  const columnas = [
    {
      clave: 'cliente',
      etiqueta: 'Cliente',
      render: (a) => <Link to={`/clientes/${a.cliente.id_cliente}`}>{`${a.cliente.nombre} ${a.cliente.apellido}`}</Link>,
    },
    { clave: 'plan', etiqueta: 'Plan' },
    { clave: 'adeudo', etiqueta: 'Adeudo', render: (a) => formatearMoneda(a.adeudo) },
    { clave: 'fecha_inicio', etiqueta: 'Inicio', render: (a) => formatearFechaCorta(a.fecha_inicio) },
    { clave: 'fecha_fin', etiqueta: 'Fin', render: (a) => formatearFechaCorta(a.fecha_fin) },
    { clave: 'estado', etiqueta: 'Estado', render: () => <Badge estado="pendiente_de_pago" /> },
    {
      clave: 'acciones',
      etiqueta: 'Acciones',
      render: (a) => (
        <Button variante="secundario" onClick={() => setCobrando(a)}>
          Registrar pago
        </Button>
      ),
    },
  ];

  return (
    <section>
      <PageHeader titulo="Adeudos" descripcion="Membresías asignadas que aún no tienen su pago registrado. Sin pago, el cliente no puede entrar." />

      {error && (
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={buscar} className="filtros">
        <FormField id="busqueda-adeudos" etiqueta="Cliente">
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o apellido" maxLength={150} />
        </FormField>
        <div className="filtros-acciones">
          <Button type="submit">Buscar</Button>
          {busqueda && (
            <Button variante="secundario" onClick={limpiar}>
              Limpiar
            </Button>
          )}
        </div>
      </form>

      {!cargando && pagina.total > 0 && (
        <p className="resumen-lista">
          {pagina.total} {pagina.total === 1 ? 'membresía pendiente' : 'membresías pendientes'} · Total por cobrar:{' '}
          <strong>{formatearMoneda(pagina.total_adeudo)}</strong>
        </p>
      )}

      <Table
        etiquetaTabla="Adeudos"
        columnas={columnas}
        filas={pagina.data.map((a) => ({ ...a, id: a.id_membresia }))}
        vacio={
          cargando ? (
            <div className="estado-vacio">
              <Spinner etiqueta="Cargando adeudos…" />
            </div>
          ) : (
            <EmptyState
              titulo={busqueda ? 'No hay adeudos con esa búsqueda.' : 'No hay adeudos.'}
              texto={busqueda ? 'Prueba con otro nombre o apellido.' : 'Todas las membresías asignadas tienen su pago registrado.'}
            />
          )
        }
      />

      <Pagination page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />

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
