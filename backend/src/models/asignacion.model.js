import { pool } from '../config/db.js';

// Asignaciones cliente–entrenador (spec 004, US2 y US7). Solo SELECT/INSERT/UPDATE, con parámetros.
// La base garantiza a lo más una activa por cliente (índice único uq_asignaciones_activa).

const SELECT_ASIGNACION = `
  SELECT a.id_asignacion, a.id_cliente, a.id_entrenador, a.fecha_inicio, a.fecha_fin, a.estado,
         u.nombre AS entrenador_nombre, u.estado AS entrenador_estado
    FROM asignaciones_entrenador a
    JOIN usuarios u ON u.id_usuario = a.id_entrenador`;

export async function activaDeCliente(idCliente, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_ASIGNACION} WHERE a.id_cliente = ? AND a.estado = 'activa' LIMIT 1`, [idCliente]);
  return filas[0] ?? null;
}

// Historial completo del cliente, de la más reciente a la más antigua.
export async function historialDeCliente(idCliente) {
  const [filas] = await pool.execute(`${SELECT_ASIGNACION} WHERE a.id_cliente = ? ORDER BY a.fecha_inicio DESC, a.id_asignacion DESC`, [idCliente]);
  return filas;
}

export async function finalizarActiva(idCliente, conexion = pool) {
  await conexion.execute(
    "UPDATE asignaciones_entrenador SET estado = 'finalizada', fecha_fin = NOW() WHERE id_cliente = ? AND estado = 'activa'",
    [idCliente],
  );
}

export async function crear({ id_cliente, id_entrenador, id_usuario }, conexion = pool) {
  const [r] = await conexion.execute(
    'INSERT INTO asignaciones_entrenador (id_cliente, id_entrenador, id_usuario) VALUES (?, ?, ?)',
    [id_cliente, id_entrenador, id_usuario],
  );
  return r.insertId;
}

// ¿El entrenador tiene hoy asignado a este cliente? (asignación activa; el estado del cliente se revisa aparte)
export async function estaAsignado(idEntrenador, idCliente, conexion = pool) {
  const [filas] = await conexion.execute(
    "SELECT 1 FROM asignaciones_entrenador WHERE id_entrenador = ? AND id_cliente = ? AND estado = 'activa' LIMIT 1",
    [idEntrenador, idCliente],
  );
  return filas.length > 0;
}

// "Mis clientes" del entrenador: asignaciones activas de clientes activos, con búsqueda y paginación.
export async function misClientes({ idEntrenador, q, limit, offset }) {
  const valores = [idEntrenador];
  let filtro = '';
  if (q) {
    filtro = " AND (c.nombre LIKE ? OR c.apellido LIKE ? OR CONCAT(c.nombre, ' ', c.apellido) LIKE ?)";
    const patron = `%${q}%`;
    valores.push(patron, patron, patron);
  }
  const base = `FROM asignaciones_entrenador a JOIN clientes c ON c.id_cliente = a.id_cliente
                WHERE a.id_entrenador = ? AND a.estado = 'activa' AND c.estado = 'activo'${filtro}`;
  const [conteo] = await pool.execute(`SELECT COUNT(*) AS total ${base}`, valores);
  const [filas] = await pool.execute(
    `SELECT c.id_cliente, c.nombre, c.apellido, c.estado, a.fecha_inicio AS desde ${base}
      ORDER BY c.apellido, c.nombre, c.id_cliente LIMIT ? OFFSET ?`,
    [...valores, String(limit), String(offset)],
  );
  return { filas, total: Number(conteo[0].total) };
}
