import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import EditorRutina from '../components/EditorRutina.jsx';
import HistorialProgreso from '../components/HistorialProgreso.jsx';
import ListaObjetivos from '../components/ListaObjetivos.jsx';
import VistaRutina from '../components/VistaRutina.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { formatearFechaCorta } from '../utils/formato.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Entrenamiento de un cliente (spec 004, US3 y US4). El entrenador asignado consulta y registra
// (/mis-clientes/:id); el administrador solo consulta (/clientes/:id/entrenamiento). El servidor decide.
export default function EntrenamientoCliente() {
  const { id } = useParams();
  const { rol } = useAuth();
  const { mostrar } = useToast();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [abierta, setAbierta] = useState(null); // rutina archivada que se está viendo
  const volver = rol === 'entrenador' ? '/mis-clientes' : `/clientes/${id}`;

  const cargar = useCallback(async () => {
    try {
      setDatos(await solicitar(`/clientes/${id}/entrenamiento`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el entrenamiento.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function verRutina(idRutina) {
    if (abierta?.id_rutina === idRutina) {
      setAbierta(null);
      return;
    }
    try {
      setAbierta(await solicitar(`/rutinas/${idRutina}`));
    } catch (e) {
      mostrar({ tipo: 'error', texto: e instanceof ErrorApi ? e.message : 'No se pudo abrir la rutina.' });
    }
  }

  if (cargando) return <Spinner etiqueta="Cargando entrenamiento…" />;
  if (!datos) {
    return (
      <section className="perfil-pagina">
        <div className="mensaje mensaje-error" role="alert">
          {error ?? 'No se pudo cargar el entrenamiento.'}
        </div>
        <Button to={volver} variante="secundario">
          Volver
        </Button>
      </section>
    );
  }

  const { cliente, entrenador, rutina_activa: activa, rutinas, objetivos = [], progresos = [], puede_editar: puedeEditar } = datos;
  const alCambiar = (texto) => {
    mostrar({ tipo: 'exito', texto });
    cargar();
  };
  const archivadas = rutinas.filter((r) => r.estado === 'archivada');

  return (
    <section className="perfil-pagina">
      <PageHeader
        titulo={`${cliente.nombre} ${cliente.apellido}`}
        descripcion={entrenador ? `Entrenador: ${entrenador.nombre}` : 'Sin entrenador asignado'}
        acciones={
          <Button to={volver} variante="secundario">
            Volver
          </Button>
        }
      />
      {cliente.estado !== 'activo' && (
        <div className="mensaje mensaje-error" role="status">
          El cliente está dado de baja: su entrenamiento solo se puede consultar.
        </div>
      )}

      <Card titulo="Rutina actual">
        {editando ? (
          <EditorRutina
            idCliente={cliente.id_cliente}
            base={activa}
            onCancelar={() => setEditando(false)}
            onGuardada={() => {
              setEditando(false);
              mostrar({ tipo: 'exito', texto: activa ? 'Se guardó la nueva versión de la rutina.' : 'Rutina creada.' });
              cargar();
            }}
          />
        ) : (
          <>
            {activa ? <VistaRutina rutina={activa} /> : <EmptyState titulo="Sin rutina" texto={puedeEditar ? 'Crea la primera rutina de este cliente.' : 'Este cliente aún no tiene rutina.'} />}
            {puedeEditar && (
              <div className="acciones acciones-izquierda">
                <Button onClick={() => setEditando(true)}>{activa ? 'Modificar rutina' : 'Crear rutina'}</Button>
              </div>
            )}
          </>
        )}
      </Card>

      <Card titulo="Objetivos">
        <ListaObjetivos idCliente={cliente.id_cliente} objetivos={objetivos} puedeEditar={puedeEditar} onCambio={alCambiar} />
      </Card>

      <Card titulo="Progreso">
        <HistorialProgreso idCliente={cliente.id_cliente} progresos={progresos} puedeEditar={puedeEditar} onCambio={alCambiar} />
      </Card>

      <Card titulo="Historial de rutinas">
        {archivadas.length === 0 ? (
          <p className="texto-suave">Sin versiones anteriores.</p>
        ) : (
          <ul className="lista-historial" aria-label="Historial de rutinas">
            {archivadas.map((r) => (
              <li key={r.id_rutina}>
                <strong>{r.nombre}</strong>
                <span className="texto-suave">
                  {formatearFechaCorta(r.fecha_creacion)} – {formatearFechaCorta(r.fecha_archivo)} · {plural(r.dias, 'día', 'días')}, {plural(r.ejercicios, 'ejercicio', 'ejercicios')} · {r.entrenador}
                </span>
                <Badge variante="neutral">Archivada</Badge>
                <Button variante="fantasma" onClick={() => verRutina(r.id_rutina)} aria-expanded={abierta?.id_rutina === r.id_rutina}>
                  {abierta?.id_rutina === r.id_rutina ? 'Ocultar' : 'Ver'}
                </Button>
                {abierta?.id_rutina === r.id_rutina && <VistaRutina rutina={abierta} mostrarEncabezado={false} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
