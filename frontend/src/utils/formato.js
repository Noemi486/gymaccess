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
