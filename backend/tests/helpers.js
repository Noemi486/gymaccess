import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/db.js';
import { hashearContrasena } from '../src/utils/contrasena.js';

// Ayudantes para las pruebas de integración.
// Las pruebas usan SIEMPRE la base separada gymaccess_test (npm test carga backend/.env.test).
// Crean datos con correos únicos "test+..." y los dejan inactivos al terminar.

// Seguro: nunca ejecutar pruebas contra la base real. Se evalúa al importar este archivo,
// antes de que cualquier prueba toque la base de datos.
if (!env.db.database.endsWith('_test')) {
  throw new Error(
    `Las pruebas solo pueden usar una base de datos cuyo nombre termine en "_test" ` +
      `(DB_NAME actual: "${env.db.database}"). Ejecuta las pruebas con "npm test", que carga backend/.env.test.`,
  );
}

let contador = 0;

// Levanta la API en un puerto aleatorio. Devuelve { url, cerrar }.
export async function iniciarServidor() {
  const servidor = app.listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  const { port } = servidor.address();
  return {
    url: `http://127.0.0.1:${port}/api`,
    cerrar: () => new Promise((resolver) => servidor.close(resolver)),
  };
}

// Envía una petición JSON. Devuelve { status, cuerpo }.
export async function solicitar(base, metodo, ruta, { token, cuerpo } = {}) {
  const cabeceras = { 'Content-Type': 'application/json' };
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  return { status: respuesta.status, cuerpo: texto ? JSON.parse(texto) : null };
}

// Firma un JWT como lo haría el servidor (solo para pruebas).
export function crearToken(idUsuario, opciones = {}) {
  return jwt.sign({ sub: String(idUsuario) }, opciones.secreto ?? env.jwt.secreto, {
    algorithm: 'HS256',
    expiresIn: opciones.expiracion ?? '1h',
  });
}

// Correo único para datos de prueba: test+<marca de tiempo>-<n>@example.com
export function correoUnico(prefijo = 'test') {
  contador += 1;
  return `${prefijo}+${Date.now()}-${contador}@example.com`;
}

// Crea una cuenta de prueba directamente en la base (correo "test+...").
// No admite el rol cliente (necesita un registro de clientes vinculado).
// Devuelve { id_usuario, correo, password, rol }.
export async function crearUsuarioDePrueba({
  rol = 'recepcionista',
  password = 'Secreta123',
  estado = 'activo',
  nombre = 'Usuario de prueba',
} = {}) {
  if (rol === 'cliente') throw new Error('crearUsuarioDePrueba no admite el rol cliente.');
  const correo = correoUnico('test');
  const hash = await hashearContrasena(password, 4); // costo bajo para que las pruebas sean rápidas
  const [resultado] = await pool.execute(
    'INSERT INTO usuarios (nombre, correo, password, rol, estado) VALUES (?, ?, ?, ?, ?)',
    [nombre, correo, hash, rol, estado],
  );
  return { id_usuario: resultado.insertId, correo, password, rol };
}

// Las cuentas de prueba se dejan inactivas (así no cuentan como administradores activos).
export async function desactivarUsuarioDePrueba(idUsuario) {
  if (!Number.isInteger(idUsuario)) return; // una creación fallida deja el id sin definir
  await pool.execute(
    "UPDATE usuarios SET estado = 'inactivo' WHERE id_usuario = ? AND correo LIKE 'test+%'",
    [idUsuario],
  );
}

// Cierra el pool de MySQL para que el proceso de pruebas pueda terminar.
export async function cerrarPool() {
  await pool.end();
}
