// Formatos de presentación de datos (solo para mostrar: nunca cambian lo que se guarda).

// Teléfono en grupos de 3 dígitos: "5551002000" -> "555 100 2000".
// Si sobra un solo dígito se une al grupo anterior (no queda un dígito suelto); el "+" inicial se conserva.
// Con menos de 4 dígitos, o sin dígitos, se devuelve el texto tal cual.
export function formatearTelefono(telefono) {
  if (typeof telefono !== 'string') return telefono;
  const original = telefono.trim();
  const digitos = original.replace(/\D/g, '');
  if (digitos.length < 4) return original;

  const grupos = digitos.match(/\d{1,3}/g);
  if (grupos.length > 1 && grupos.at(-1).length === 1) {
    const sobrante = grupos.pop();
    grupos[grupos.length - 1] += sobrante;
  }
  return `${original.startsWith('+') ? '+' : ''}${grupos.join(' ')}`;
}

// Número de cliente con ceros a la izquierda (mínimo 4 dígitos): 12 -> "Cliente #0012".
export function formatearNumeroCliente(id) {
  return `Cliente #${String(id).padStart(4, '0')}`;
}

// Dinero para mostrar: 450 -> "$450.00"; 1250 -> "$1,250.00". Sin valor o no numérico -> "—".
export function formatearMoneda(numero) {
  const valor = Number(numero);
  if (numero === null || numero === undefined || numero === '' || !Number.isFinite(valor)) return '—';
  const [enteros, decimales] = Math.abs(valor).toFixed(2).split('.');
  return `${valor < 0 ? '-' : ''}$${enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimales}`;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "2026-10-14" o "2026-10-14T15:00:00.000Z" -> "14 oct 2026". Un texto de solo fecha no se pasa por
// Date (evita el desfase de un día por zona horaria). Sin valor o no válido -> "".
export function formatearFechaCorta(valor) {
  if (!valor) return '';
  const solo = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (solo) return `${Number(solo[3])} ${MESES_CORTOS[Number(solo[2]) - 1]} ${solo[1]}`;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

// Fecha y hora de un DATETIME -> "14 oct 2026 · 10:02".
// El servidor envía los DATETIME como instante ISO con zona ("2026-10-14T16:02:11.000Z"): se muestran en la hora
// local del navegador. Un texto sin zona ("2026-10-14 10:02:11") se muestra tal cual, sin convertir.
const MESES_FECHA_HORA = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dos = (n) => String(n).padStart(2, '0');
export function formatearFechaHora(valor) {
  const texto = String(valor ?? '');
  if (/(Z|[+-]\d{2}:\d{2})$/.test(texto)) {
    const fecha = new Date(texto);
    if (Number.isNaN(fecha.getTime())) return texto;
    return `${fecha.getDate()} ${MESES_FECHA_HORA[fecha.getMonth()]} ${fecha.getFullYear()} · ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
  }
  const coincide = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!coincide) return texto;
  const [, anio, mes, dia, hora, minuto] = coincide;
  return `${Number(dia)} ${MESES_FECHA_HORA[Number(mes) - 1]} ${anio} · ${hora}:${minuto}`;
}
