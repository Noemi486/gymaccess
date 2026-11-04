import { pool } from '../config/db.js';

// Objetivos de entrenamiento (spec 004, US4, FR-012). Solo SELECT/INSERT/UPDATE.

const SELECT_OBJETIVO = `
  SELECT o.id_objetivo, o.id_cliente, o.id_entrenador, o.descripcion, o.meta,
         DATE_FORMAT(o.fecha_limite, '%Y-%m-%d') AS fecha_limite, o.estado, o.fecha_creacion, o.fecha_cierre,
         u.nombre AS entrenador_nombre
    FROM objetivos_entrenamiento o
    JOIN usuarios u ON u.id_usuario = o.id_entrenador`;

// En curso primero; dentro de cada grupo, el más reciente primero.
export async function listarDeCliente(idCliente) {
  const [filas] = await pool.execute(
    `${SELECT_OBJETIVO} WHERE o.id_cliente = ? ORDER BY o.estado = 'en_curso' DESC, o.fecha_creacion DESC, o.id_objetivo DESC`,
    [idCliente],
  );
  return filas;
}

export async function buscarPorId(id, conexion = pool, { bloquear = false } = {}) {
  const [filas] = await conexion.execute(`${SELECT_OBJETIVO} WHERE o.id_objetivo = ? LIMIT 1${bloquear ? ' FOR UPDATE OF o' : ''}`, [id]);
  return filas[0] ?? null;
}

export async function crear({ id_cliente, id_entrenador, descripcion, meta, fecha_limite }, conexion = pool) {
  const [r] = await conexion.execute(
    'INSERT INTO objetivos_entrenamiento (id_cliente, id_entrenador, descripcion, meta, fecha_limite) VALUES (?, ?, ?, ?, ?)',
    [id_cliente, id_entrenador, descripcion, meta ?? null, fecha_limite ?? null],
  );
  return r.insertId;
}

// Solo las columnas enviadas (lista cerrada).
export async function actualizar(id, campos, conexion = pool) {
  const columnas = ['descripcion', 'meta', 'fecha_limite'].filter((c) => campos[c] !== undefined);
  if (columnas.length === 0) return;
  await conexion.execute(`UPDATE objetivos_entrenamiento SET ${columnas.map((c) => `${c} = ?`).join(', ')} WHERE id_objetivo = ?`, [
    ...columnas.map((c) => campos[c]),
    id,
  ]);
}

export async function cerrar(id, estado, conexion = pool) {
  await conexion.execute(
    "UPDATE objetivos_entrenamiento SET estado = ?, fecha_cierre = NOW() WHERE id_objetivo = ? AND estado = 'en_curso'",
    [estado, id],
  );
}

// Para el Dashboard y Mi entrenamiento se reutiliza listarDeCliente.
