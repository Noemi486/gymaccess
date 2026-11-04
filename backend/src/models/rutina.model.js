import { pool } from '../config/db.js';

// Rutinas versionadas y sus ejercicios (spec 004, US3, FR-009 a FR-011). Solo SELECT/INSERT/UPDATE.
// La base garantiza a lo más una rutina activa por cliente (uq_rutinas_activa).

const SELECT_RUTINA = `
  SELECT r.id_rutina, r.id_cliente, r.id_entrenador, r.nombre, r.indicaciones, r.estado,
         r.fecha_creacion, r.fecha_archivo, r.id_rutina_anterior, u.nombre AS entrenador_nombre
    FROM rutinas r
    JOIN usuarios u ON u.id_usuario = r.id_entrenador`;

export async function buscarPorId(idRutina, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_RUTINA} WHERE r.id_rutina = ? LIMIT 1`, [idRutina]);
  return filas[0] ?? null;
}

// Con `bloquear` (en una transacción) bloquea la rutina activa del cliente hasta el COMMIT.
export async function activaDeCliente(idCliente, conexion = pool, { bloquear = false } = {}) {
  const [filas] = await conexion.execute(
    `${SELECT_RUTINA} WHERE r.id_cliente = ? AND r.estado = 'activa' LIMIT 1${bloquear ? ' FOR UPDATE' : ''}`,
    [idCliente],
  );
  return filas[0] ?? null;
}

// Historial (todas las versiones, de la más reciente a la más antigua) con el número de ejercicios.
export async function listarDeCliente(idCliente) {
  const [filas] = await pool.execute(
    `SELECT r.id_rutina, r.nombre, r.estado, r.fecha_creacion, r.fecha_archivo, u.nombre AS entrenador_nombre,
            (SELECT COUNT(*) FROM ejercicios_rutina e WHERE e.id_rutina = r.id_rutina) AS ejercicios,
            (SELECT COUNT(DISTINCT e.dia) FROM ejercicios_rutina e WHERE e.id_rutina = r.id_rutina) AS dias
       FROM rutinas r JOIN usuarios u ON u.id_usuario = r.id_entrenador
      WHERE r.id_cliente = ?
      ORDER BY r.fecha_creacion DESC, r.id_rutina DESC`,
    [idCliente],
  );
  return filas;
}

export async function ejerciciosDe(idRutina, conexion = pool) {
  const [filas] = await conexion.execute(
    `SELECT dia, orden, nombre, series, repeticiones, peso_kg, descanso_seg, instrucciones
       FROM ejercicios_rutina WHERE id_rutina = ? ORDER BY dia, orden`,
    [idRutina],
  );
  return filas;
}

export async function archivar(idRutina, conexion = pool) {
  await conexion.execute("UPDATE rutinas SET estado = 'archivada', fecha_archivo = NOW() WHERE id_rutina = ? AND estado = 'activa'", [idRutina]);
}

export async function crear({ id_cliente, id_entrenador, nombre, indicaciones, id_rutina_anterior = null }, conexion = pool) {
  const [r] = await conexion.execute(
    'INSERT INTO rutinas (id_cliente, id_entrenador, nombre, indicaciones, id_rutina_anterior) VALUES (?, ?, ?, ?, ?)',
    [id_cliente, id_entrenador, nombre, indicaciones ?? null, id_rutina_anterior],
  );
  return r.insertId;
}

export async function insertarEjercicio(idRutina, dia, orden, e, conexion = pool) {
  await conexion.execute(
    `INSERT INTO ejercicios_rutina (id_rutina, dia, orden, nombre, series, repeticiones, peso_kg, descanso_seg, instrucciones)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [idRutina, dia, orden, e.nombre, e.series ?? null, e.repeticiones ?? null, e.peso_kg ?? null, e.descanso_seg ?? null, e.instrucciones ?? null],
  );
}
