import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import FormularioTipoMembresia from '../components/FormularioTipoMembresia.jsx';
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
import { formatearMoneda } from '../utils/formato.js';

const LIMITE = 20;

// Tipos de membresía (planes). El administrador los gestiona; el recepcionista solo los consulta
// (y el servidor solo le entrega los activos).
export default function TiposMembresia() {
  const { rol } = useAuth();
  const { mostrar } = useToast();
  const esAdmin = rol === 'administrador';

  const [pagina, setPagina] = useState({ data: [], page: 1, limit: LIMITE, total: 0 });
  const [numeroPagina, setNumeroPagina] = useState(1);
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [formulario, setFormulario] = useState(null); // { tipo } al editar, {} al crear
  const [pendiente, setPendiente] = useState(null); // plan que se va a desactivar

  const cargar = useCallback(async () => {
    setCargando(true);
    const parametros = new URLSearchParams({ page: String(numeroPagina), limit: String(LIMITE) });
    if (busqueda) parametros.set('q', busqueda);
    if (esAdmin && filtroEstado) parametros.set('estado', filtroEstado);
    try {
      setPagina(await solicitar(`/tipos-membresia?${parametros}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar la lista de planes.');
    } finally {
      setCargando(false);
    }
  }, [numeroPagina, busqueda, filtroEstado, esAdmin]);

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

  async function cambiarEstado(plan, estado) {
    setError(null);
    try {
      const actualizado = await solicitar(`/tipos-membresia/${plan.id_tipo_membresia}/estado`, {
        metodo: 'PATCH',
        cuerpo: { estado },
      });
      setPagina((actual) => ({
        ...actual,
        data: actual.data.map((fila) => (fila.id_tipo_membresia === actualizado.id_tipo_membresia ? actualizado : fila)),
      }));
      mostrar({ tipo: 'exito', texto: estado === 'activo' ? 'Plan activado.' : 'Plan desactivado.' });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el estado del plan.');
    }
  }

  async function confirmarDesactivacion() {
    const plan = pendiente;
    setPendiente(null);
    await cambiarEstado(plan, 'inactivo');
  }

  function alGuardar(guardado, editando) {
    setFormulario(null);
    mostrar({ tipo: 'exito', texto: editando ? 'Plan actualizado.' : 'Plan registrado.' });
    if (editando) {
      setPagina((actual) => ({
        ...actual,
        data: actual.data.map((fila) => (fila.id_tipo_membresia === guardado.id_tipo_membresia ? guardado : fila)),
      }));
    } else {
      cargar();
    }
  }

  const cerrarFormulario = useCallback(() => setFormulario(null), []);
  const cancelarDesactivacion = useCallback(() => setPendiente(null), []);

  const columnas = [
    {
      clave: 'nombre',
      etiqueta: 'Plan',
      render: (plan) => (
        <div className="plan-nombre">
          <strong>{plan.nombre}</strong>
          {plan.descripcion && <span className="plan-descripcion">{plan.descripcion}</span>}
        </div>
      ),
    },
    { clave: 'duracion', etiqueta: 'Duración', render: (plan) => `${plan.duracion} ${plan.duracion === 1 ? 'día' : 'días'}` },
    { clave: 'precio', etiqueta: 'Precio', render: (plan) => formatearMoneda(plan.precio) },
    { clave: 'estado', etiqueta: 'Estado', render: (plan) => <Badge estado={plan.estado} /> },
    ...(esAdmin
      ? [
          {
            clave: 'acciones',
            etiqueta: 'Acciones',
            render: (plan) => (
              <div className="acciones acciones-fila">
                <Button variante="secundario" onClick={() => setFormulario({ tipo: plan })}>
                  Editar
                </Button>
                {plan.estado === 'activo' ? (
                  <Button variante="secundario" onClick={() => setPendiente(plan)}>
                    Desactivar
                  </Button>
                ) : (
                  <Button variante="secundario" onClick={() => cambiarEstado(plan, 'activo')}>
                    Activar
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <section>
      <PageHeader
        titulo="Tipos de membresía"
        descripcion={esAdmin ? 'Define los planes que ofrece el gimnasio.' : 'Planes disponibles para asignar a los clientes.'}
        acciones={
          esAdmin ? (
            <Button icono={<Plus size={18} aria-hidden="true" />} onClick={() => setFormulario({})}>
              Nuevo tipo
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
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre del plan" maxLength={80} />
        </FormField>
        <div className="filtros-acciones">
          <Button type="submit">Buscar</Button>
          {busqueda && (
            <Button variante="secundario" onClick={limpiar}>
              Limpiar
            </Button>
          )}
        </div>
        {esAdmin && (
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
        )}
      </form>

      <Table
        etiquetaTabla="Tipos de membresía"
        columnas={columnas}
        filas={pagina.data.map((plan) => ({ ...plan, id: plan.id_tipo_membresia }))}
        vacio={
          cargando ? (
            <div className="estado-vacio">
              <Spinner etiqueta="Cargando planes…" />
            </div>
          ) : (
            <EmptyState
              titulo="No hay tipos de membresía."
              texto={esAdmin ? 'Registra el primero con "Nuevo tipo".' : 'Todavía no hay planes disponibles.'}
            />
          )
        }
      />

      <Pagination page={pagina.page} limit={pagina.limit} total={pagina.total} onCambiar={setNumeroPagina} />

      {formulario && <FormularioTipoMembresia tipo={formulario.tipo ?? null} onCerrar={cerrarFormulario} onGuardado={alGuardar} />}

      <ConfirmDialog
        abierto={Boolean(pendiente)}
        titulo="Desactivar plan"
        texto={
          pendiente
            ? `El plan "${pendiente.nombre}" dejará de poder elegirse para nuevas membresías. Las membresías existentes no cambian y el plan se puede activar de nuevo.`
            : ''
        }
        textoConfirmar="Desactivar"
        onConfirmar={confirmarDesactivacion}
        onCancelar={cancelarDesactivacion}
      />
    </section>
  );
}
