import bcrypt from 'bcryptjs';

// Contraseñas: política (FR-007a) y hash con bcrypt (FR-007).
// bcrypt solo usa los primeros 72 bytes, por eso se limita la longitud a 72.

export const LONGITUD_MINIMA = 8;
export const LONGITUD_MAXIMA = 72;
export const COSTO_BCRYPT = 10;

export const MENSAJE_POLITICA =
  `La contraseña debe tener entre ${LONGITUD_MINIMA} y ${LONGITUD_MAXIMA} caracteres, ` +
  'con al menos una letra y un número.';

// Devuelve null si la contraseña cumple la política; si no, el mensaje a mostrar.
export function validarPoliticaContrasena(password) {
  if (typeof password !== 'string') return MENSAJE_POLITICA;
  const largo = password.length;
  const cumple =
    largo >= LONGITUD_MINIMA && largo <= LONGITUD_MAXIMA && /\p{L}/u.test(password) && /\d/.test(password);
  return cumple ? null : MENSAJE_POLITICA;
}

export function hashearContrasena(password, costo = COSTO_BCRYPT) {
  return bcrypt.hash(password, costo);
}

export function compararContrasena(password, hash) {
  return bcrypt.compare(password, hash);
}
