import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { formatearFechaHora, formatearMoneda } from '../../utils/formato.js';

const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

// Tarjeta "Mis pagos": últimos 5 pagos y el adeudo destacado ("Sin adeudo" o el monto pendiente).
export default function MisPagos({ resumen }) {
  const pagos = resumen?.pagos ?? [];
  const adeudo = resumen?.adeudo;
  return (
    <Card titulo="Mis pagos" className="tarjeta-cliente">
      <div className="tarjeta-cliente-fila">
        <span>Adeudo</span>
        {adeudo ? (
          <Badge variante="error">{`Debes ${formatearMoneda(adeudo.monto)}`}</Badge>
        ) : (
          <Badge variante="exito">Sin adeudo</Badge>
        )}
      </div>
      {pagos.length === 0 ? (
        <EmptyState titulo="Aún no tienes pagos registrados" texto="Tus pagos aparecerán aquí." />
      ) : (
        <ul className="tarjeta-lista" aria-label="Mis pagos">
          {pagos.map((p, i) => (
            <li key={`${p.fecha_pago}-${i}`}>
              <span>{formatearFechaHora(p.fecha_pago)}</span>
              <strong>{formatearMoneda(p.monto)}</strong>
              <span className="tarjeta-lista-detalle">
                {p.plan} · {METODOS[p.metodo_pago] ?? p.metodo_pago}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
