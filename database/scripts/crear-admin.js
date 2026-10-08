// Crea el administrador inicial del sistema (FR-025).
//
// Uso (desde la raíz del repositorio):
//   node --env-file=backend/.env database/scripts/crear-admin.js
//
// Lee ADMIN_EMAIL, ADMIN_NOMBRE y ADMIN_PASSWORD del entorno (p. ej. de backend/.env).
// - Es idempotente: si ya existe un usuario con ese correo, no hace nada.
// - Se conecta con el usuario de aplicación (gymaccess_app); solo hace un INSERT.
// - Nunca imprime la contraseña. Esta no debe subirse al repositorio.
//
// Reutiliza el pool y las utilidades del backend para no duplicar dependencias.

import { pool } from '../../backend/src/config/db.js';
import { normalizarCorreo } from '../../backend/src/utils/correo.js';
import { hashearContrasena, validarPoliticaContrasena } from '../../backend/src/utils/contrasena.js';

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fallar(mensaje) {
  console.error(`Error: ${mensaje}`);
  process.exitCode = 1;
}

async function main() {
  const correo = normalizarCorreo(process.env.ADMIN_EMAIL);
  const nombre = process.env.ADMIN_NOMBRE?.trim();
  const password = process.env.ADMIN_PASSWORD;

  const faltantes = [];
  if (!correo) faltantes.push('ADMIN_EMAIL');
  if (!nombre) faltantes.push('ADMIN_NOMBRE');
  if (!password) faltantes.push('ADMIN_PASSWORD');
  if (faltantes.length > 0) {
    return fallar(`faltan variables de entorno: ${faltantes.join(', ')}.`);
  }
  if (!FORMATO_CORREO.test(correo) || correo.length > 150) {
    return fallar('ADMIN_EMAIL no es un correo válido (máximo 150 caracteres).');
  }
  if (nombre.length > 120) {
    return fallar('ADMIN_NOMBRE no puede superar 120 caracteres.');
  }
  const problemaPassword = validarPoliticaContrasena(password);
  if (problemaPassword) {
    return fallar(`ADMIN_PASSWORD no es válida. ${problemaPassword}`);
  }

  const [existentes] = await pool.execute('SELECT id_usuario, rol FROM usuarios WHERE correo = ? LIMIT 1', [
    correo,
  ]);
  if (existentes.length > 0) {
    console.log(`Ya existe un usuario con el correo ${correo} (rol: ${existentes[0].rol}). No se hizo ningún cambio.`);
    return undefined;
  }

  const hash = await hashearContrasena(password);
  await pool.execute(
    "INSERT INTO usuarios (nombre, correo, password, rol, estado) VALUES (?, ?, ?, 'administrador', 'activo')",
    [nombre, correo, hash],
  );
  console.log(`Administrador creado: ${nombre} <${correo}>.`);
  return undefined;
}

try {
  await main();
} catch (error) {
  // No se imprime el error completo para no exponer detalles de conexión.
  fallar(`no se pudo crear el administrador (${error.code ?? 'error desconocido'}).`);
} finally {
  await pool.end();
}
