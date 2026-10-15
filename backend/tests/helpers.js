import assert from 'node:assert/strict';
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
  // El número de proceso evita choques entre archivos de prueba que corren en paralelo
  // (cada uno tiene su propio contador y pueden coincidir en el mismo milisegundo).
  return `${prefijo}+${Date.now()}-${process.pid}-${contador}@example.com`;
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

// ---------------------------------------------------------------------------------------------
// Ayudantes del Sprint 2 (membresías, pagos, rostros y accesos).
// Todo se crea con datos "test+..." en gymaccess_test y se limpia con limpiarDatosDePrueba.
// Los descriptores faciales son vectores SINTÉTICOS: nunca rostros reales.
// ---------------------------------------------------------------------------------------------

// Fecha de la base de datos (CURDATE) desplazada `dias` días, como texto YYYY-MM-DD.
export async function fechaRelativa(dias = 0) {
  const [filas] = await pool.execute("SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL ? DAY), '%Y-%m-%d') AS fecha", [dias]);
  return filas[0].fecha;
}

// Cliente activo con correo único (inserción directa).
export async function crearClienteDePrueba({ nombre = 'Clienta', apellido = `Prueba${Date.now()}`, estado = 'activo', conCorreo = true } = {}) {
  const correo = conCorreo ? correoUnico('test') : null;
  const [r] = await pool.execute(
    'INSERT INTO clientes (nombre, apellido, correo, telefono, estado) VALUES (?, ?, ?, ?, ?)',
    [nombre, apellido, correo, '555-300-4000', estado],
  );
  return { id_cliente: r.insertId, nombre, apellido, correo, estado };
}

// Plan de membresía con nombre único (inserción directa).
export async function crearTipoMembresiaDePrueba({ precio = '450.00', duracion = 30, estado = 'activo' } = {}) {
  const nombre = `Plan test ${Date.now()}-${process.pid}-${++contador}`;
  const [r] = await pool.execute(
    'INSERT INTO tipos_membresia (nombre, descripcion, duracion, precio, estado) VALUES (?, ?, ?, ?, ?)',
    [nombre, 'Plan de prueba', duracion, precio, estado],
  );
  return { id_tipo_membresia: r.insertId, nombre, precio: String(precio), duracion, estado };
}

// Membresía con fechas exactas (inserción directa). Con `pagada` agrega un pago registrado por `monto`
// (por defecto, el precio del plan). Devuelve { id_membresia, id_pago? }.
export async function crearMembresiaDePrueba({ idCliente, idTipo, inicio, fin, estado = 'activa', pagada = false, monto, idUsuario = null }) {
  const [r] = await pool.execute(
    'INSERT INTO membresias (id_cliente, id_tipo_membresia, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?, ?)',
    [idCliente, idTipo, inicio, fin, estado],
  );
  const resultado = { id_membresia: r.insertId };
  if (pagada) {
    const [[tipo]] = await pool.execute('SELECT precio FROM tipos_membresia WHERE id_tipo_membresia = ?', [idTipo]);
    const [p] = await pool.execute(
      "INSERT INTO pagos (id_cliente, id_membresia, monto, metodo_pago, estado, id_usuario) VALUES (?, ?, ?, 'efectivo', 'registrado', ?)",
      [idCliente, r.insertId, monto ?? tipo.precio, idUsuario],
    );
    resultado.id_pago = p.insertId;
  }
  return resultado;
}

// Vector de 128 números repetible (generador mulberry32) en [-0.5, 0.5]. Semillas distintas dan vectores
// muy distintos (distancia euclidiana ≈ 4.6), muy lejos del umbral de coincidencia de 0.5.
export function crearDescriptorSintetico(semilla = 1) {
  let estado = semilla >>> 0;
  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: 128 }, () => Number((siguiente() - 0.5).toFixed(6)));
}

// Vector a distancia euclidiana EXACTA `distancia` de `base` (se desplaza solo la primera coordenada).
export function descriptorCercano(base, distancia) {
  return base.map((valor, i) => (i === 0 ? valor + distancia : valor));
}

// Cuenta de personal con su token, lista para llamar a la API.
export async function crearUsuarioConRol(rol) {
  const cuenta = await crearUsuarioDePrueba({ rol });
  return { ...cuenta, token: crearToken(cuenta.id_usuario) };
}

// Falla si el cuerpo de una respuesta contiene el descriptor facial en cualquier forma.
export function sinBiometria(cuerpo) {
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo ?? null);
  assert.ok(!/descriptor/i.test(texto), 'la respuesta no debe contener datos biométricos');
}

// Limpieza: usuarios inactivos, clientes inactivos, membresías canceladas, rostros inactivos y planes
// inactivos (no se borra nada: el usuario de la aplicación no tiene DELETE).
export async function limpiarDatosDePrueba({ usuarios = [], clientes = [], tipos = [] } = {}) {
  for (const id of usuarios) await desactivarUsuarioDePrueba(id);
  for (const id of clientes) {
    await pool.execute("UPDATE rostros SET estado = 'inactivo' WHERE id_cliente = ?", [id]);
    await pool.execute("UPDATE membresias SET estado = 'cancelada' WHERE id_cliente = ?", [id]);
    await pool.execute("UPDATE clientes SET estado = 'inactivo' WHERE id_cliente = ? AND correo LIKE 'test+%'", [id]);
  }
  for (const id of tipos) {
    await pool.execute("UPDATE tipos_membresia SET estado = 'inactivo' WHERE id_tipo_membresia = ? AND nombre LIKE 'Plan test %'", [id]);
  }
}

