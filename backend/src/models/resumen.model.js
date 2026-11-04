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

// ---- Sprint 2 (US9): indicadores de accesos y membresías ----

// Accesos autorizados de hoy.
export async function contarAccesosAutorizadosHoy() {
  const [filas] = await pool.execute("SELECT COUNT(*) AS total FROM accesos WHERE fecha = CURDATE() AND resultado = 'autorizado'");
  return Number(filas[0].total);
}

// Membresías por vencer: vigentes (activa, pagada y cubren hoy) de clientes activos a las que les quedan 0 a 5 días.
// Misma regla que utils/membresia.js (porVencer) y que el Dashboard.
export async function contarMembresiasPorVencer() {
  const [filas] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM membresias m JOIN clientes c ON c.id_cliente = m.id_cliente
     WHERE c.estado = 'activo' AND m.estado = 'activa'
       AND m.fecha_inicio <= CURDATE() AND m.fecha_fin >= CURDATE()
       AND DATEDIFF(m.fecha_fin, CURDATE()) <= 5
       AND EXISTS (SELECT 1 FROM pagos p WHERE p.id_membresia = m.id_membresia AND p.estado = 'registrado')`,
  );
  return Number(filas[0].total);
}

// Entrenador: clientes distintos con acceso autorizado hoy.
export async function contarClientesQueEntraronHoy() {
  const [filas] = await pool.execute(
    "SELECT COUNT(DISTINCT id_cliente) AS total FROM accesos WHERE fecha = CURDATE() AND resultado = 'autorizado' AND id_cliente IS NOT NULL",
  );
  return Number(filas[0].total);
}

// Entrenador: últimos clientes que entraron hoy (una fila por cliente, con su última hora de entrada).
// Proyección básica: solo id, nombre, apellido y hora.
export async function ultimosClientesQueEntraronHoy(limite) {
  const [filas] = await pool.execute(
    `SELECT c.id_cliente, c.nombre, c.apellido, MAX(a.hora) AS hora
     FROM accesos a JOIN clientes c ON c.id_cliente = a.id_cliente
     WHERE a.fecha = CURDATE() AND a.resultado = 'autorizado'
     GROUP BY c.id_cliente, c.nombre, c.apellido
     ORDER BY hora DESC, c.id_cliente DESC LIMIT ?`,
    [String(limite)],
  );
  return filas.map((fila) => ({ id_cliente: fila.id_cliente, nombre: fila.nombre, apellido: fila.apellido, hora: fila.hora }));
}

// Sprint 3 (FR-024): clientes activos asignados hoy al entrenador (básico: id, nombre, apellido, estado).
export async function misClientesAsignados(idEntrenador, limite) {
  const base = `FROM asignaciones_entrenador a JOIN clientes c ON c.id_cliente = a.id_cliente
                WHERE a.id_entrenador = ? AND a.estado = 'activa' AND c.estado = 'activo'`;
  const [conteo] = await pool.execute(`SELECT COUNT(*) AS total ${base}`, [idEntrenador]);
  const [filas] = await pool.execute(
    `SELECT c.id_cliente, c.nombre, c.apellido, c.estado ${base} ORDER BY c.apellido, c.nombre, c.id_cliente LIMIT ?`,
    [idEntrenador, String(limite)],
  );
  return { filas, total: Number(conteo[0].total) };
}
