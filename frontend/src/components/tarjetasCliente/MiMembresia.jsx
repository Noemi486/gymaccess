import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { formatearFechaCorta, formatearMoneda } from '../../utils/formato.js';

// "Vence en N días" / "Vence hoy" / "Vencida hace N días" (siempre con texto, no solo color).
export function textoVencimiento(dias) {
  if (dias > 0) return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (dias === 0) return 'Vence hoy';
  const hace = Math.abs(dias);
  return `Vencida hace ${hace} ${hace === 1 ? 'día' : 'días'}`;
}

// Color de la barra: verde (> 5 días), amarillo (5 o menos) y rojo (vencida). Anexo de la spec 002.
export function colorBarra(membresia) {
  if (membresia.estado === 'vencida' || membresia.dias_restantes < 0) return 'error';
  if (membresia.dias_restantes <= 5) return 'advertencia';
  return 'exito';
}

// Tarjeta "Mi membresía" del Inicio del cliente (US9, FR-042).
export default function MiMembresia({ resumen }) {
  const membresia = resumen?.membresia;
  if (!membresia) {
    return (
      <Card titulo="Mi membresía">
        <EmptyState titulo="Aún no tienes una membresía" texto="Pasa a recepción para elegir un plan." />
      </Card>
    );
  }

  const pendiente = membresia.estado === 'pendiente_de_pago';
  const conBarra = ['vigente', 'vencida'].includes(membresia.estado);
  const duracion = membresia.tipo?.duracion || 1;
  const porcentaje = Math.max(0, Math.min(100, Math.round((Math.max(0, membresia.dias_restantes) / duracion) * 100)));
  const estadoInsignia = membresia.estado === 'vigente' && membresia.por_vencer ? 'por_vencer' : membresia.estado;
  const color = colorBarra(membresia);

  return (
    <Card titulo="Mi membresía" className="tarjeta-cliente">
      <div className="tarjeta-cliente-fila">
        <strong>{membresia.tipo?.nombre}</strong>
        <Badge estado={estadoInsignia} />
      </div>
      {pendiente ? (
        <p className="tarjeta-aviso tarjeta-aviso-advertencia">
          Pendiente de pago: debes <strong>{formatearMoneda(membresia.adeudo)}</strong>. Pasa a recepción para activar tu membresía.
        </p>
      ) : (
        <>
          <p className="tarjeta-cliente-dato">Vence el {formatearFechaCorta(membresia.fecha_fin)}</p>
          {conBarra && (
            <>
              <div
                className={`barra-progreso barra-${color}`}
                role="progressbar"
                aria-label="Días restantes de la membresía"
                aria-valuemin={0}
                aria-valuemax={duracion}
                aria-valuenow={Math.max(0, membresia.dias_restantes)}
              >
                <span style={{ width: `${porcentaje}%` }} />
              </div>
              <p className={`tarjeta-cliente-dato texto-${color}`}>{textoVencimiento(membresia.dias_restantes)}</p>
            </>
          )}
        </>
      )}
    </Card>
  );
}
