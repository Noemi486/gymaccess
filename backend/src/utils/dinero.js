// Dinero en CENTAVOS (enteros) para comparar y sumar sin errores de decimales flotantes.
// MySQL entrega los DECIMAL como texto ("450.00"); la API los devuelve como número con dos decimales.

const FORMATO = /^\d+(\.\d{1,2})?$/;

// Convierte "450", "450.5", "450.00" o un número a centavos. Lanza Error si no es un monto válido
// (negativo, con más de dos decimales, texto o no finito).
export function aCentavos(valor) {
  const texto = typeof valor === 'number' ? (Number.isFinite(valor) ? String(valor) : '') : String(valor ?? '').trim();
  if (!FORMATO.test(texto)) throw new Error('Monto no válido.');
  const [enteros, decimales = ''] = texto.split('.');
  return Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
}

// 45000 -> 450 (número con dos decimales como máximo).
export function deCentavos(centavos) {
  return Number((centavos / 100).toFixed(2));
}

// 45000 -> "$450.00"; 125000 -> "$1,250.00"
export function formatearMonto(centavos) {
  const [enteros, decimales] = (centavos / 100).toFixed(2).split('.');
  return `$${enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimales}`;
}
