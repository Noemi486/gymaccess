// Reglas de membresía que no dependen de la base de datos: estado efectivo, días restantes y fechas.
// Las fechas son texto "YYYY-MM-DD" (el pool de MySQL entrega las columnas DATE así) y se comparan
// como texto, que en este formato equivale a compararlas cronológicamente. No hay zonas horarias:
// "hoy" siempre viene de la base de datos (CURDATE()).

const MS_POR_DIA = 24 * 60 * 60 * 1000;
export const DIAS_POR_VENCER = 5;

// Texto "YYYY-MM-DD" -> milisegundos UTC a medianoche (sin desfases de zona horaria).
function aUtc(fecha) {
  const [anio, mes, dia] = String(fecha).split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

// Suma (o resta, con negativos) días a una fecha "YYYY-MM-DD".
export function sumarDias(fecha, dias) {
  return new Date(aUtc(fecha) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

// La fecha de fin incluye el día de inicio como día 1: inicio 2026-10-14 y 30 días -> 2026-11-12.
export function calcularFechaFin(fechaInicio, duracionDias) {
  return sumarDias(fechaInicio, duracionDias - 1);
}

// Días que faltan hasta la fecha de fin: 0 el último día, negativo si ya venció.
export function diasRestantes(fechaFin, hoy) {
  return Math.round((aUtc(fechaFin) - aUtc(hoy)) / MS_POR_DIA);
}

// Estado efectivo (data-model.md y research R1). El orden de las reglas importa.
//   cancelada > suspendida > vencida > pendiente_de_pago > proxima > vigente
export function estadoEfectivo({ estado, fecha_inicio, fecha_fin, tiene_pago }, hoy) {
  if (estado === 'cancelada') return 'cancelada';
  if (estado === 'suspendida') return 'suspendida';
  if (fecha_fin < hoy) return 'vencida';
  if (!tiene_pago) return 'pendiente_de_pago';
  if (fecha_inicio > hoy) return 'proxima';
  return 'vigente';
}

// "Por vencer": vigente y con 0 a 5 días restantes (FR-013).
export function porVencer(membresia, hoy) {
  if (estadoEfectivo(membresia, hoy) !== 'vigente') return false;
  const dias = diasRestantes(membresia.fecha_fin, hoy);
  return dias >= 0 && dias <= DIAS_POR_VENCER;
}

// ¿Cubre el periodo la fecha de hoy? (para "membresía en curso")
export function cubreHoy({ fecha_inicio, fecha_fin }, hoy) {
  return fecha_inicio <= hoy && hoy <= fecha_fin;
}
