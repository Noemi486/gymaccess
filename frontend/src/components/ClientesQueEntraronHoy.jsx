import { Link } from 'react-router-dom';
import Avatar from './ui/Avatar.jsx';
import Card from './ui/Card.jsx';
import EmptyState from './ui/EmptyState.jsx';

// Lista del entrenador "Clientes que entraron hoy" (US9, FR-044): avatar de iniciales, nombre completo y hora.
// Proyección básica: sin contacto, motivos de rechazo ni datos financieros.
export default function ClientesQueEntraronHoy({ clientes }) {
  return (
    <Card titulo="Clientes que entraron hoy" className="clientes-nuevos">
      {clientes.length === 0 ? (
        <EmptyState titulo="Nadie ha entrado hoy todavía" texto="Los clientes que entren aparecerán aquí." />
      ) : (
        <ul className="clientes-nuevos-lista" aria-label="Clientes que entraron hoy">
          {clientes.map((cliente) => {
            const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`;
            return (
              <li key={cliente.id_cliente} className="cliente-nuevo">
                <Avatar nombre={nombreCompleto} />
                <Link to={`/clientes/${cliente.id_cliente}`} className="cliente-nuevo-nombre enlace-fila">
                  {nombreCompleto}
                </Link>
                <time className="cliente-nuevo-fecha">{String(cliente.hora).slice(0, 5)}</time>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
