import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { formatearFechaCorta } from '../../utils/formato.js';

// Tarjeta "Mis últimas visitas": los últimos 5 intentos de acceso del propio cliente.
export default function MisVisitas({ resumen }) {
  const visitas = resumen?.visitas ?? [];
  return (
    <Card titulo="Mis últimas visitas" className="tarjeta-cliente">
      {visitas.length === 0 ? (
        <EmptyState titulo="Aún no tienes visitas registradas" texto="Aparecerán aquí cuando entres al gimnasio." />
      ) : (
        <ul className="tarjeta-lista" aria-label="Mis últimas visitas">
          {visitas.map((v, i) => (
            <li key={`${v.fecha}-${v.hora}-${i}`}>
              <span>
                {formatearFechaCorta(v.fecha)} · {String(v.hora).slice(0, 5)}
              </span>
              <Badge estado={v.resultado} />
              {v.motivo_rechazo && <span className="tarjeta-lista-detalle">{v.motivo_rechazo}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
