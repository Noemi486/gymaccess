import { Link } from 'react-router-dom';
import Avatar from './ui/Avatar.jsx';
import Badge from './ui/Badge.jsx';
import Card from './ui/Card.jsx';
import EmptyState from './ui/EmptyState.jsx';

// "12 oct 2026"
const fechaCorta = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Lista "Clientes nuevos": los últimos clientes registrados, con avatar de iniciales, nombre completo,
// estado y fecha de registro. Solo usa los datos básicos (id, nombre, apellido, estado y fecha):
// no muestra teléfono, correo ni dirección, que el entrenador no recibe.
export default function ClientesNuevos({ clientes }) {
  return (
    <Card titulo="Clientes nuevos" className="clientes-nuevos">
      {clientes.length === 0 ? (
        <EmptyState titulo="Aún no hay clientes nuevos" texto="Los últimos clientes registrados aparecerán aquí." />
      ) : (
        <ul className="clientes-nuevos-lista">
          {clientes.map((cliente) => {
            const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`;
            return (
              <li key={cliente.id_cliente} className="cliente-nuevo">
                <Avatar nombre={nombreCompleto} />
                <Link to={`/clientes/${cliente.id_cliente}`} className="cliente-nuevo-nombre enlace-fila">
                  {nombreCompleto}
                </Link>
                <Badge estado={cliente.estado} />
                <time className="cliente-nuevo-fecha" dateTime={cliente.fecha_registro}>
                  {fechaCorta(cliente.fecha_registro)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
