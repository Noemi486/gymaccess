// Insignia de estado. Siempre muestra texto además del color (no depende solo del color).
export const VARIANTE_POR_ESTADO = {
  activo: 'exito',
  vigente: 'exito',
  por_vencer: 'advertencia',
  pendiente_de_pago: 'advertencia',
  proxima: 'info',
  autorizado: 'exito',
  inactivo: 'neutral',
  suspendida: 'advertencia',
  vencida: 'error',
  cancelada: 'error',
  rechazado: 'error',
};

export const ETIQUETA_POR_ESTADO = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  pendiente_de_pago: 'Pendiente de pago',
  proxima: 'Próxima',
  vencida: 'Vencida',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
  autorizado: 'Autorizado',
  rechazado: 'Rechazado',
};

// Uso: <Badge estado="activo" /> o <Badge variante="info">Texto</Badge>
export default function Badge({ estado, variante, children }) {
  const clase = variante ?? VARIANTE_POR_ESTADO[estado] ?? 'neutral';
  const texto = children ?? ETIQUETA_POR_ESTADO[estado] ?? estado;
  return <span className={`badge badge-${clase}`}>{texto}</span>;
}
