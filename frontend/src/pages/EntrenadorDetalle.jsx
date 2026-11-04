import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import Table from '../components/ui/Table.jsx';
import { formatearFechaCorta } from '../utils/formato.js';

// Detalle de un entrenador con sus clientes asignados (spec 004, US7, FR-008). Administrador y recepcionista.
export default function EntrenadorDetalle() {
  const { id } = useParams();
  const { rol } = useAuth();
  const [entrenador, setEntrenador] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    solicitar(`/entrenadores/${id}`)
      .then((datos) => activo && setEntrenador(datos))
      .catch((e) => activo && setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el entrenador.'))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [id]);

  if (cargando) return <Spinner etiqueta="Cargando entrenador…" />;
  if (!entrenador) {
    return (
      <section className="perfil-pagina">
        <div className="mensaje mensaje-error" role="alert">
          {error ?? 'El entrenador no existe.'}
        </div>
        <Button to="/entrenadores" variante="secundario">
          Volver a la lista
        </Button>
      </section>
    );
  }

  const columnas = [
    { clave: 'nombre', etiqueta: 'Cliente', render: (c) => <Link to={`/clientes/${c.id_cliente}`}>{`${c.nombre} ${c.apellido}`}</Link> },
    { clave: 'estado', etiqueta: 'Estado', render: (c) => <Badge estado={c.estado} /> },
    { clave: 'desde', etiqueta: 'Asignado desde', render: (c) => formatearFechaCorta(c.desde) },
  ];

  return (
    <section className="perfil-pagina">
      <PageHeader
        titulo={entrenador.nombre}
        descripcion={entrenador.especialidad ?? 'Especialidad sin capturar'}
        acciones={
          rol === 'administrador' ? (
            <Button to={`/entrenadores/${entrenador.id_usuario}/editar`} variante="secundario" icono={<Pencil size={16} aria-hidden="true" />}>
              Editar
            </Button>
          ) : null
        }
      />
      <div className="card">
        <dl className="datos-lista">
          <div>
            <dt>Estado</dt>
            <dd>
              <Badge estado={entrenador.estado} />
            </dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{entrenador.correo}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{entrenador.telefono ?? 'Sin capturar'}</dd>
          </div>
          <div>
            <dt>Clientes asignados</dt>
            <dd>{entrenador.clientes_asignados}</dd>
          </div>
        </dl>
      </div>

      <h2 className="seccion-titulo">Clientes asignados</h2>
      <Table
        etiquetaTabla="Clientes asignados"
        columnas={columnas}
        filas={entrenador.clientes.map((c) => ({ ...c, id: c.id_cliente }))}
        vacio={<EmptyState titulo="Sin clientes asignados." texto="Asigna clientes desde el detalle de cada cliente." />}
      />
      <div className="acciones">
        <Button to="/entrenadores" variante="secundario">
          Volver a la lista
        </Button>
      </div>
    </section>
  );
}
