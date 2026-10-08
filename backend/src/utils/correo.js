// Normaliza un correo: recorta espacios y pasa a minúsculas.
// Un valor vacío o solo con espacios significa "sin correo" y devuelve null
// (la tabla clientes permite varios NULL en la columna única, pero no varios '').
export function normalizarCorreo(valor) {
  if (valor === undefined || valor === null) return null;
  const limpio = String(valor).trim().toLowerCase();
  return limpio === '' ? null : limpio;
}
