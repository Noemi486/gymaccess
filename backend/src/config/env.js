import { leerFaceKey } from './faceKey.js';

// Lectura y validación de las variables de entorno.
// Los valores reales viven en backend/.env (nunca en el repositorio).

const obligatorias = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'FACE_KEY'];

function entero(nombre, porDefecto) {
  const bruto = process.env[nombre];
  if (bruto === undefined || bruto.trim() === '') return porDefecto;
  const numero = Number(bruto);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`La variable de entorno ${nombre} debe ser un entero positivo.`);
  }
  return numero;
}

const faltantes = obligatorias.filter((nombre) => !process.env[nombre]?.trim());
if (faltantes.length > 0) {
  throw new Error(
    `Faltan variables de entorno: ${faltantes.join(', ')}. ` +
      'Crea backend/.env a partir de backend/.env.example.',
  );
}

// La constitución prohíbe conectar la aplicación con el usuario root.
if (process.env.DB_USER.trim().toLowerCase() === 'root') {
  throw new Error('DB_USER no puede ser root: usa el usuario de aplicación gymaccess_app.');
}

if (process.env.JWT_SECRET.trim().length < 16) {
  throw new Error('JWT_SECRET debe tener al menos 16 caracteres.');
}

// Clave de cifrado de los descriptores faciales: 64 hexadecimales (32 bytes). Falla con un mensaje claro.
const faceKey = leerFaceKey(process.env.FACE_KEY);

export const env = Object.freeze({
  db: Object.freeze({
    host: process.env.DB_HOST.trim(),
    port: entero('DB_PORT', 3306),
    user: process.env.DB_USER.trim(),
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME.trim(),
  }),
  jwt: Object.freeze({
    secreto: process.env.JWT_SECRET.trim(),
    expiracion: process.env.JWT_EXPIRES_IN?.trim() || '8h',
  }),
  faceKey,
  puerto: entero('PORT', 3000),
  corsOrigen: process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173',
  login: Object.freeze({
    maxIntentos: entero('LOGIN_MAX_ATTEMPTS', 5),
    minutosBloqueo: entero('LOGIN_LOCK_MINUTES', 15),
  }),
});
