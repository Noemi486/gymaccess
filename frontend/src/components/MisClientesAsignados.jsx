import { Link } from 'react-router-dom';
import Avatar from './ui/Avatar.jsx';
import Card from './ui/Card.jsx';
import EmptyState from './ui/EmptyState.jsx';

// Inicio del entrenador: "Mis clientes asignados" (spec 004, FR-024; reservado en la spec 002).
// Proyección básica: nombre y estado, con enlace a su entrenamiento.
export default function MisClientesAsignados({ datos }) {
  const { total, lista } = datos;
  return (
    <Card titulo="Mis clientes asignados" className="clientes-nuevos">
      {lista.length === 0 ? (
        <EmptyState titulo="Aún no tienes clientes asignados" texto="Recepción te asigna clientes desde su detalle." />
      ) : (
        <>
          <ul className="clientes-nuevos-lista" aria-label="Mis clientes asignados">
            {lista.map((c) => {
              const nombre = `${c.nombre} ${c.apellido}`;
              return (
                <li key={c.id_cliente} className="cliente-nuevo">
                  <Avatar nombre={nombre} />
                  <Link to={`/clientes/${c.id_cliente}`} className="cliente-nuevo-nombre enlace-fila">
                    {nombre}
                  </Link>
                </li>
              );
            })}
          </ul>
          {total > lista.length && (
            <p className="texto-suave">
              <Link to="/mis-clientes">Ver los {total} clientes</Link>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
