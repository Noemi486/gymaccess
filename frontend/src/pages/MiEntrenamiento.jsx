import { useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import HistorialProgreso from '../components/HistorialProgreso.jsx';
import ListaObjetivos from '../components/ListaObjetivos.jsx';
import VistaRutina from '../components/VistaRutina.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { formatearFechaCorta } from '../utils/formato.js';

// "Mi entrenamiento" del cliente (spec 004, US5, FR-019): solo lectura y solo lo propio (el servidor usa la sesión).
export default function MiEntrenamiento() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    solicitar('/clientes/me/entrenamiento')
      .then((d) => activo && setDatos(d))
      .catch((e) => activo && setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar tu entrenamiento.'))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  if (cargando) return <Spinner etiqueta="Cargando tu entrenamiento…" />;
  if (!datos) {
    return (
      <div className="mensaje mensaje-error" role="alert">
        {error}
      </div>
    );
  }

  const { entrenador, rutina_activa: rutina, objetivos, progresos } = datos;
  const nada = () => {};

  return (
    <section className="perfil-pagina">
      <PageHeader
        titulo="Mi entrenamiento"
        descripcion={entrenador ? `Tu entrenador: ${entrenador.nombre} · desde el ${formatearFechaCorta(entrenador.desde)}` : 'Aún no tienes entrenador asignado. Pregunta en recepción.'}
      />

      <Card titulo="Mi rutina">
        {rutina ? (
          <VistaRutina rutina={rutina} />
        ) : (
          <EmptyState titulo="Aún no tienes rutina" texto={entrenador ? 'Tu entrenador la preparará pronto.' : 'Cuando tengas entrenador, él te preparará una.'} />
        )}
      </Card>

      <Card titulo="Mis objetivos">
        <ListaObjetivos idCliente={null} objetivos={objetivos} puedeEditar={false} onCambio={nada} />
      </Card>

      <Card titulo="Mi progreso">
        <HistorialProgreso idCliente={null} progresos={progresos} puedeEditar={false} onCambio={nada} />
      </Card>
    </section>
  );
}
