import { pool } from '../config/db.js';

// Consultas de solo lectura para el resumen del inicio. Solo SELECT (el usuario gymaccess_app
// no tiene DELETE) y sin datos recibidos del usuario: todas las fechas se calculan en MySQL
// con el mismo reloj que asigna `fecha_registro`.

// Clientes por estado: { activo: n, inactivo: n }.
export async function contarClientesPorEstado() {
  const [filas] = await pool.execute('SELECT estado, COUNT(*) AS total FROM clientes GROUP BY estado');
  return Object.fromEntries(filas.map((fila) => [fila.estado, Number(fila.total)]));
}

// Clientes registrados hoy (desde las 00:00 del día de hoy).
export async function contarClientesRegistradosHoy() {
  const [filas] = await pool.execute('SELECT COUNT(*) AS total FROM clientes WHERE fecha_registro >= CURDATE()');
  return Number(filas[0].total);
}

// Clientes registrados en el mes actual (desde el día 1 a las 00:00).
export async function contarClientesRegistradosEsteMes() {
  const [filas] = await pool.execute(
    "SELECT COUNT(*) AS total FROM clientes WHERE fecha_registro >= DATE_FORMAT(CURDATE(), '%Y-%m-01')",
  );
  return Number(filas[0].total);
}

// Clientes registrados en los últimos 7 días: hoy y los 6 días anteriores (7 días naturales).
export async function contarClientesRegistradosUltimos7Dias() {
  const [filas] = await pool.execute(
    'SELECT COUNT(*) AS total FROM clientes WHERE fecha_registro >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
  );
  return Number(filas[0].total);
}

// Últimos clientes registrados, del más reciente al más antiguo (el id desempata).
export async function ultimosClientes(limite) {
  // LIMIT como texto: mysql2 lo envía así en las sentencias preparadas.
  const [filas] = await pool.execute('SELECT * FROM clientes ORDER BY fecha_registro DESC, id_cliente DESC LIMIT ?', [
    String(limite),
  ]);
  return filas;
}

// Cuentas de usuario por rol: { administrador: n, ... }.
export async function contarUsuariosPorRol() {
  const [filas] = await pool.execute('SELECT rol, COUNT(*) AS total FROM usuarios GROUP BY rol');
  return Object.fromEntries(filas.map((fila) => [fila.rol, Number(fila.total)]));
}
