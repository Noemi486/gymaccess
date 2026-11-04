import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fsReal from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Respaldo diario de la base local (US13, FR-059 a FR-063). Se ejecuta con `npm run respaldo` desde el
// Programador de tareas de Windows. Usa mysqldump con el usuario de solo lectura gymaccess_respaldo.
// - La contraseña va en un archivo de opciones temporal (--defaults-extra-file), nunca en los argumentos,
//   y ese archivo se borra al terminar.
// - Se escribe primero a "<nombre>.sql.parcial" y solo se renombra si mysqldump terminó bien: nunca queda
//   un respaldo incompleto con nombre de respaldo válido.
// - Solo tras un respaldo correcto se conservan los CONSERVAR más recientes; un fallo no borra nada.
// - Cada ejecución deja una línea en respaldos.log (sin contraseñas).

export const CONSERVAR = 7;
export const PATRON_RESPALDO = /^gymaccess_\d{4}-\d{2}-\d{2}_\d{4}\.sql$/;
const BITACORA = 'respaldos.log';
const FIN_MYSQLDUMP = '-- Dump completed';

const dos = (n) => String(n).padStart(2, '0');

// gymaccess_AAAA-MM-DD_HHMM.sql con la hora local de la laptop.
export function nombreRespaldo(fecha = new Date()) {
  return `gymaccess_${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}_${dos(fecha.getHours())}${dos(fecha.getMinutes())}.sql`;
}

const fechaHoraLocal = (fecha) =>
  `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;

// Lee la configuración de las variables de entorno (backend/.env). Lanza un error claro si falta algo.
export function leerConfigRespaldo(variables = process.env) {
  const faltantes = ['RESPALDO_DB_USER', 'RESPALDO_DB_PASSWORD', 'RESPALDO_DIR'].filter((n) => !variables[n]?.trim());
  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno para el respaldo: ${faltantes.join(', ')}. Agrégalas a backend/.env (ver docs/respaldo.md).`);
  }
  const usuario = variables.RESPALDO_DB_USER.trim();
  if (usuario.toLowerCase() === 'root' || usuario === variables.DB_USER?.trim()) {
    throw new Error('RESPALDO_DB_USER debe ser el usuario exclusivo de respaldo (gymaccess_respaldo), no root ni el usuario de la aplicación.');
  }
  return {
    usuario,
    password: variables.RESPALDO_DB_PASSWORD,
    host: variables.DB_HOST?.trim() || 'localhost',
    puerto: variables.DB_PORT?.trim() || '3306',
    base: variables.DB_NAME?.trim() || 'gymaccess',
    dir: path.resolve(variables.RESPALDO_DIR.trim()),
    mysqldump: variables.MYSQLDUMP_PATH?.trim() || 'mysqldump',
  };
}

// Escapa un valor para el archivo de opciones de MySQL (entre comillas dobles).
const valorOpcion = (texto) => `"${String(texto).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

// Ejecuta un programa y resuelve con { codigo, error } (error = texto de stderr o del fallo al iniciar).
export function ejecutarProceso(comando, args) {
  return new Promise((resolver) => {
    let stderr = '';
    let hijo;
    try {
      hijo = spawn(comando, args, { windowsHide: true });
    } catch (e) {
      resolver({ codigo: -1, error: e.code === 'ENOENT' ? 'ENOENT' : e.message });
      return;
    }
    hijo.stderr?.on('data', (d) => {
      stderr += d;
    });
    hijo.on('error', (e) => resolver({ codigo: -1, error: e.code === 'ENOENT' ? 'ENOENT' : e.message }));
    hijo.on('close', (codigo) => resolver({ codigo, error: stderr.trim() }));
  });
}

// Mensaje claro para la bitácora y la consola, sin la contraseña y sin rutas temporales.
function limpiarMensaje(texto, { password, archivoOpciones }) {
  let m = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (password) m = m.split(password).join('***');
  if (archivoOpciones) m = m.split(archivoOpciones).join('[opciones]');
  return m.slice(0, 300) || 'mysqldump terminó con error.';
}

async function existe(fs, ruta) {
  try {
    await fs.stat(ruta);
    return true;
  } catch {
    return false;
  }
}

async function terminaBien(fs, ruta) {
  const contenido = await fs.readFile(ruta, 'utf8');
  return contenido.trimEnd().split('\n').at(-1)?.startsWith(FIN_MYSQLDUMP) ?? false;
}

// Hace un respaldo. Devuelve { ok: true, archivo, bytes, borrados } o { ok: false, mensaje }.
// Las dependencias se pueden inyectar para probarlo sin MySQL.
export async function ejecutarRespaldo({
  config,
  ahora = new Date(),
  ejecutar = ejecutarProceso,
  fs = fsReal,
  dirTemporal = tmpdir(),
  conservar = CONSERVAR,
}) {
  const nombre = nombreRespaldo(ahora);
  const final = path.join(config.dir, nombre);
  const parcial = `${final}.parcial`;
  const archivoOpciones = path.join(dirTemporal, `gymaccess-respaldo-${randomBytes(8).toString('hex')}.cnf`);

  const anotar = (linea) =>
    fs.appendFile(path.join(config.dir, BITACORA), `${fechaHoraLocal(ahora)} | ${linea}\n`, 'utf8').catch(() => {});
  const fallar = async (mensaje) => {
    await anotar(`error | ${mensaje}`);
    return { ok: false, mensaje };
  };

  let carpeta;
  try {
    carpeta = await fs.stat(config.dir);
  } catch {
    carpeta = null;
  }
  if (!carpeta?.isDirectory()) {
    // Sin carpeta tampoco hay dónde dejar la bitácora: solo se informa.
    return { ok: false, mensaje: `La carpeta de respaldo no existe: ${config.dir}. Créala o corrige RESPALDO_DIR.` };
  }

  try {
    await fs.writeFile(archivoOpciones, `[client]\npassword=${valorOpcion(config.password)}\n`, { encoding: 'utf8', mode: 0o600 });
    const args = [
      `--defaults-extra-file=${archivoOpciones}`, // debe ir primero
      `--host=${config.host}`,
      `--port=${config.puerto}`,
      `--user=${config.usuario}`,
      '--single-transaction',
      '--no-tablespaces',
      '--set-gtid-purged=OFF',
      '--default-character-set=utf8mb4',
      '--hex-blob',
      config.base, // sin --databases: el archivo no lleva CREATE DATABASE ni USE y se restaura en la base que se elija
      `--result-file=${parcial}`,
    ];
    const { codigo, error } = await ejecutar(config.mysqldump, args);

    if (codigo !== 0) {
      if (await existe(fs, parcial)) await fs.rm(parcial, { force: true });
      if (error === 'ENOENT') return fallar('No se encontró mysqldump. Indica su ruta completa en MYSQLDUMP_PATH (ver docs/respaldo.md).');
      return fallar(limpiarMensaje(error, { password: config.password, archivoOpciones }));
    }
    if (!(await existe(fs, parcial)) || !(await terminaBien(fs, parcial))) {
      if (await existe(fs, parcial)) await fs.rm(parcial, { force: true });
      return fallar('El respaldo quedó incompleto y se descartó.');
    }

    await fs.rename(parcial, final);
    const { size } = await fs.stat(final);

    // Rotación: solo los respaldos con nombre válido, del más reciente al más antiguo.
    const respaldos = (await fs.readdir(config.dir)).filter((n) => PATRON_RESPALDO.test(n)).sort().reverse();
    const borrados = respaldos.slice(conservar);
    for (const viejo of borrados) await fs.rm(path.join(config.dir, viejo), { force: true });

    await anotar(`exito | ${nombre} | ${size} bytes${borrados.length ? ` | se eliminaron ${borrados.length} respaldos antiguos` : ''}`);
    return { ok: true, archivo: final, bytes: size, borrados };
  } catch (e) {
    if (await existe(fs, parcial)) await fs.rm(parcial, { force: true });
    return fallar(limpiarMensaje(e.message, { password: config.password, archivoOpciones }));
  } finally {
    await fs.rm(archivoOpciones, { force: true }).catch(() => {});
  }
}
