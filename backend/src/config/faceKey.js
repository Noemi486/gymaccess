// Lectura y validación de FACE_KEY, la clave que cifra los descriptores faciales (AES-256-GCM).
// Debe ser de 32 bytes escritos como 64 caracteres hexadecimales. El mensaje de error nunca
// incluye el valor recibido, para no filtrar la clave en consolas ni registros.

const MENSAJE =
  'FACE_KEY debe tener 64 caracteres hexadecimales (32 bytes). ' +
  'Genera una con el comando de specs/003-membresias-pagos-acceso/quickstart.md.';

export function leerFaceKey(valor) {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!/^[0-9a-fA-F]{64}$/.test(texto)) throw new Error(MENSAJE);
  return Buffer.from(texto, 'hex');
}
