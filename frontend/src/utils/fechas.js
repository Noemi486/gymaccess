// Cálculo de fechas "YYYY-MM-DD" sin zonas horarias (solo para mostrar avisos y límites en formularios;
// el servidor es quien decide la fecha de hoy y valida todo).

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const aUtc = (fecha) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
};

export function sumarDias(fecha, dias) {
  return new Date(aUtc(fecha) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

// Fecha de hoy del navegador como "YYYY-MM-DD".
export function hoyLocal() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

// El día de inicio cuenta como el primero: inicio 2026-10-14 y 30 días -> 2026-11-12.
export function calcularFechaFin(inicio, duracion) {
  return sumarDias(inicio, duracion - 1);
}

export const MAX_DIAS_ADELANTO = 60;
