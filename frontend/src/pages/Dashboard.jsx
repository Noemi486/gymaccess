import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, ClipboardList, DoorOpen, Dumbbell, RefreshCw, ShieldAlert, Target, TrendingUp, Trophy, UserCheck, UserX, Users, Wallet } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Table from '../components/ui/Table.jsx';
import { formatearFechaCorta, formatearMoneda } from '../utils/formato.js';

const PERIODOS = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: 'semana', etiqueta: 'Semana' },
  { id: 'mes', etiqueta: 'Mes en curso' },
  { id: 'rango', etiqueta: 'Rango' },
];
const NOMBRE_PERIODO = { hoy: 'Hoy', semana: 'Semana', mes: 'Mes en curso', rango: 'Rango' };

const formatearHora = (hora) => String(hora ?? '').slice(0, 5);

function textoPeriodo(periodo) {
  if (!periodo) return '';
  const nombre = NOMBRE_PERIODO[periodo.tipo] ?? periodo.tipo;
  if (periodo.desde === periodo.hasta) return `${nombre}: ${formatearFechaCorta(periodo.desde)}`;
  return `${nombre}: del ${formatearFechaCorta(periodo.desde)} al ${formatearFechaCorta(periodo.hasta)}`;
}

// Dashboard del administrador (US8). El estado actual (clientes y membresías) es a la fecha de hoy y no depende
// del periodo; los ingresos y los accesos sí se recalculan con el periodo elegido. Solo lectura.
export default function Dashboard() {
  const [periodo, setPeriodo] = useState('hoy');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rangoAplicado, setRangoAplicado] = useState(null); // { desde, hasta } enviado al servidor
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [errorRango, setErrorRango] = useState(null);

  const cargar = useCallback(async () => {
    if (periodo === 'rango' && !rangoAplicado) return;
    setCargando(true);
    const parametros = new URLSearchParams({ periodo });
    if (periodo === 'rango') {
      parametros.set('desde', rangoAplicado.desde);
      parametros.set('hasta', rangoAplicado.hasta);
    }
    try {
      setDatos(await solicitar(`/dashboard?${parametros}`));
      setError(null);
      setErrorRango(null);
    } catch (e) {
      const mensaje = e instanceof ErrorApi ? (e.detalles?.[0]?.message ?? e.message) : 'No se pudo cargar el dashboard.';
      if (periodo === 'rango' && e instanceof ErrorApi && e.status === 400) setErrorRango(mensaje);
      else setError(mensaje);
    } finally {
      setCargando(false);
    }
  }, [periodo, rangoAplicado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function elegirPeriodo(id) {
    setPeriodo(id);
    setErrorRango(null);
    if (id !== 'rango') setRangoAplicado(null);
  }

  function aplicarRango(evento) {
    evento.preventDefault();
    if (!desde || !hasta) return setErrorRango('Indica la fecha de inicio y la fecha final.');
    if (desde > hasta) return setErrorRango('La fecha final no puede ser anterior a la inicial.');
    setErrorRango(null);
    setRangoAplicado({ desde, hasta });
  }

  const estado = datos?.estado_actual;
  const del = datos?.periodo_datos;

  const columnas = [
    { clave: 'fecha', etiqueta: 'Fecha y hora', render: (a) => `${formatearFechaCorta(a.fecha)} · ${formatearHora(a.hora)}` },
    { clave: 'cliente', etiqueta: 'Cliente', render: (a) => (a.cliente ? `${a.cliente.nombre} ${a.cliente.apellido}` : 'No identificado') },
    { clave: 'resultado', etiqueta: 'Resultado', render: (a) => <Badge estado={a.resultado} /> },
    { clave: 'motivo_rechazo', etiqueta: 'Motivo', render: (a) => a.motivo_rechazo ?? '—' },
  ];

  return (
    <section>
      <PageHeader
        titulo="Dashboard"
        descripcion="Situación general del gimnasio."
        acciones={
          <Button variante="secundario" icono={<RefreshCw size={16} aria-hidden="true" />} onClick={cargar} cargando={cargando && Boolean(datos)}>
            Actualizar
          </Button>
        }
      />

      <div className="selector-periodo" role="group" aria-label="Periodo">
        {PERIODOS.map((p) => (
          <Button key={p.id} variante={periodo === p.id ? 'principal' : 'secundario'} aria-pressed={periodo === p.id} onClick={() => elegirPeriodo(p.id)}>
            {p.etiqueta}
          </Button>
        ))}
      </div>

      {periodo === 'rango' && (
        <form onSubmit={aplicarRango} className="filtros" noValidate>
          <FormField id="dashboard-desde" etiqueta="Desde">
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </FormField>
          <FormField id="dashboard-hasta" etiqueta="Hasta">
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </FormField>
          <div className="filtros-acciones">
            <Button type="submit">Aplicar</Button>
          </div>
        </form>
      )}
      {errorRango && (
        <div className="mensaje mensaje-error" role="alert">
          {errorRango}
        </div>
      )}
      {error && (
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      )}

      {!datos && cargando ? (
        <Spinner etiqueta="Cargando dashboard…" />
      ) : (
        datos && (
          <>
            <h2 className="dashboard-titulo">Clientes y membresías</h2>
            <p className="dashboard-nota">Estado actual, a la fecha de hoy: no cambia con el periodo.</p>
            <div className="inicio-indicadores">
              <StatCard etiqueta="Clientes activos" valor={estado.clientes_activos} icono={<Users size={20} aria-hidden="true" />} />
              <StatCard etiqueta="Con membresía vigente" valor={estado.con_membresia_vigente} icono={<UserCheck size={20} aria-hidden="true" />} />
              <StatCard etiqueta="Con membresía por vencer" valor={estado.con_membresia_por_vencer} icono={<CalendarClock size={20} aria-hidden="true" />} />
              <StatCard etiqueta="Con membresía vencida" valor={estado.con_membresia_vencida} icono={<UserX size={20} aria-hidden="true" />} />
            </div>

            <h2 className="dashboard-titulo">Del periodo</h2>
            <p className="dashboard-nota">{textoPeriodo(datos.periodo)}</p>
            <div className="inicio-indicadores">
              <StatCard etiqueta="Ingresos" valor={formatearMoneda(del.ingresos)} icono={<Wallet size={20} aria-hidden="true" />} />
              <StatCard etiqueta="Accesos autorizados" valor={del.accesos_autorizados} icono={<DoorOpen size={20} aria-hidden="true" />} />
              <StatCard etiqueta="Accesos rechazados" valor={del.accesos_rechazados} icono={<ShieldAlert size={20} aria-hidden="true" />} />
            </div>

            <h2 className="dashboard-titulo">Accesos recientes</h2>
            <Table
              etiquetaTabla="Accesos recientes"
              columnas={columnas}
              filas={datos.accesos_recientes.map((a) => ({ ...a, id: a.id_acceso }))}
              vacio={<EmptyState titulo="No hay accesos en este periodo." texto="Cambia el periodo para ver otros días." />}
            />

            {datos.entrenamiento && <SeccionEntrenamiento e={datos.entrenamiento} periodo={textoPeriodo(datos.periodo)} />}
          </>
        )
      )}
    </section>
  );
}

// Sprint 3 (spec 004, US6, FR-021 y FR-022): resumen de entrenadores, asignaciones y progreso, sin datos personales.
const COLUMNAS_CARGA = [
  { clave: 'nombre', etiqueta: 'Entrenador' },
  { clave: 'clientes_asignados', etiqueta: 'Clientes asignados' },
  { clave: 'rutinas_activas', etiqueta: 'Rutinas' },
  { clave: 'avances_periodo', etiqueta: 'Avances del periodo' },
];

function SeccionEntrenamiento({ e, periodo }) {
  return (
    <>
      <h2 className="dashboard-titulo">Entrenamiento</h2>
      <p className="dashboard-nota">Estado actual, salvo "Objetivos cumplidos" y "Avances del periodo" ({periodo}).</p>
      <div className="inicio-indicadores">
        <StatCard etiqueta="Entrenadores activos" valor={e.entrenadores_activos} icono={<Dumbbell size={20} aria-hidden="true" />} />
        <StatCard etiqueta="Clientes con entrenador" valor={e.clientes_con_entrenador} icono={<UserCheck size={20} aria-hidden="true" />} />
        <StatCard etiqueta="Clientes sin entrenador" valor={e.clientes_sin_entrenador} icono={<UserX size={20} aria-hidden="true" />} />
        <StatCard etiqueta="Rutinas activas" valor={e.rutinas_activas} icono={<ClipboardList size={20} aria-hidden="true" />} />
        <StatCard etiqueta="Objetivos en curso" valor={e.objetivos_en_curso} icono={<Target size={20} aria-hidden="true" />} />
        <StatCard etiqueta="Objetivos cumplidos" valor={e.objetivos_cumplidos_periodo} icono={<Trophy size={20} aria-hidden="true" />} />
        <StatCard
          etiqueta="Con avance en 30 días"
          valor={`${e.con_avance_30_dias} (${e.porcentaje_con_avance} %)`}
          icono={<TrendingUp size={20} aria-hidden="true" />}
        />
      </div>
      <h3 className="dashboard-titulo">Carga por entrenador</h3>
      <Table
        etiquetaTabla="Carga por entrenador"
        columnas={COLUMNAS_CARGA}
        filas={e.carga.map((f) => ({ ...f, id: f.id_usuario }))}
        vacio={<EmptyState titulo="No hay entrenadores activos." texto="Regístralos en la sección Entrenadores." />}
      />
    </>
  );
}
