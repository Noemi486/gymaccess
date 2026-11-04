import { pool } from '../config/db.js';

// Avances (spec 004, US4, FR-013 a FR-015). Solo SELECT/INSERT/UPDATE.
// `del_dia` dice si se registró hoy (según la base), condición para poder corregirlo (FR-014).

const SELECT_PROGRESO = `
  SELECT p.id_progreso, p.id_cliente, p.id_entrenador, DATE_FORMAT(p.fecha, '%Y-%m-%d') AS fecha,
         p.peso_kg, p.grasa_pct, p.cintura_cm, p.comentario, p.fecha_registro, p.fecha_actualizacion,
         (DATE(p.fecha_registro) = CURDATE()) AS del_dia, u.nombre AS entrenador_nombre
    FROM progresos_clientes p
    JOIN usuarios u ON u.id_usuario = p.id_entrenador`;

// Del más reciente al más antiguo: por fecha del avance y, el mismo día, por orden de registro.
export async function listarDeCliente(idCliente) {
  const [filas] = await pool.execute(
    `${SELECT_PROGRESO} WHERE p.id_cliente = ? ORDER BY p.fecha DESC, p.fecha_registro DESC, p.id_progreso DESC`,
    [idCliente],
  );
  return filas;
}

export async function buscarPorId(id, conexion = pool, { bloquear = false } = {}) {
  const [filas] = await conexion.execute(`${SELECT_PROGRESO} WHERE p.id_progreso = ? LIMIT 1${bloquear ? ' FOR UPDATE OF p' : ''}`, [id]);
  return filas[0] ?? null;
}

export async function crear({ id_cliente, id_entrenador, fecha, peso_kg, grasa_pct, cintura_cm, comentario }, conexion = pool) {
  const [r] = await conexion.execute(
    `INSERT INTO progresos_clientes (id_cliente, id_entrenador, fecha, peso_kg, grasa_pct, cintura_cm, comentario)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id_cliente, id_entrenador, fecha, peso_kg ?? null, grasa_pct ?? null, cintura_cm ?? null, comentario ?? null],
  );
  return r.insertId;
}

export async function corregir(id, campos, conexion = pool) {
  const columnas = ['fecha', 'peso_kg', 'grasa_pct', 'cintura_cm', 'comentario'].filter((c) => campos[c] !== undefined);
  if (columnas.length === 0) return;
  await conexion.execute(
    `UPDATE progresos_clientes SET ${columnas.map((c) => `${c} = ?`).join(', ')}, fecha_actualizacion = NOW() WHERE id_progreso = ?`,
    [...columnas.map((c) => campos[c]), id],
  );
}
