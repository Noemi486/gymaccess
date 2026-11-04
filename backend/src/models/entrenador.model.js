import { pool } from '../config/db.js';

// Entrenadores (spec 004): cuentas con rol entrenador + su ficha opcional (tabla entrenadores).
// El identificador de un entrenador en toda la API es usuarios.id_usuario. Solo SELECT/INSERT/UPDATE, con parámetros.

// clientes_asignados = asignaciones activas (el estado del cliente se muestra aparte).
const SELECT_ENTRENADOR = `
  SELECT u.id_usuario, u.nombre, u.correo, u.estado, u.fecha_registro,
         e.id_entrenador, e.telefono, e.especialidad,
         (SELECT COUNT(*) FROM asignaciones_entrenador a
           WHERE a.id_entrenador = u.id_usuario AND a.estado = 'activa') AS clientes_asignados
    FROM usuarios u
    LEFT JOIN entrenadores e ON e.id_usuario = u.id_usuario
   WHERE u.rol = 'entrenador'`;

export async function listar({ q, estado, limit, offset }) {
  const condiciones = [];
  const valores = [];
  if (estado) {
    condiciones.push('u.estado = ?');
    valores.push(estado);
  }
  if (q) {
    condiciones.push('(u.nombre LIKE ? OR u.correo LIKE ? OR e.especialidad LIKE ?)');
    const patron = `%${q}%`;
    valores.push(patron, patron, patron);
  }
  const filtro = condiciones.length ? ` AND ${condiciones.join(' AND ')}` : '';
  const [conteo] = await pool.execute(
    `SELECT COUNT(*) AS total FROM usuarios u LEFT JOIN entrenadores e ON e.id_usuario = u.id_usuario WHERE u.rol = 'entrenador'${filtro}`,
    valores,
  );
  const [filas] = await pool.execute(`${SELECT_ENTRENADOR}${filtro} ORDER BY u.nombre, u.id_usuario LIMIT ? OFFSET ?`, [
    ...valores,
    String(limit),
    String(offset),
  ]);
  return { filas, total: Number(conteo[0].total) };
}

// Con `bloquear` (en una transacción) bloquea la fila de la cuenta hasta el COMMIT.
export async function buscarPorId(idUsuario, conexion = pool, { bloquear = false } = {}) {
  const sql = bloquear
    ? "SELECT u.id_usuario, u.estado FROM usuarios u WHERE u.id_usuario = ? AND u.rol = 'entrenador' FOR UPDATE"
    : `${SELECT_ENTRENADOR} AND u.id_usuario = ? LIMIT 1`;
  const [filas] = await conexion.execute(sql, [idUsuario]);
  return filas[0] ?? null;
}

export async function crearFicha({ id_usuario, telefono = null, especialidad = null }, conexion = pool) {
  await conexion.execute('INSERT INTO entrenadores (id_usuario, telefono, especialidad) VALUES (?, ?, ?)', [id_usuario, telefono, especialidad]);
}

// Actualiza los campos enviados de la ficha; si la cuenta no tenía ficha (creada en Usuarios y roles), la crea.
export async function guardarFicha(idUsuario, { telefono, especialidad }, conexion = pool) {
  const [existe] = await conexion.execute('SELECT id_entrenador FROM entrenadores WHERE id_usuario = ? FOR UPDATE', [idUsuario]);
  if (existe.length === 0) {
    await crearFicha({ id_usuario: idUsuario, telefono: telefono ?? null, especialidad: especialidad ?? null }, conexion);
    return;
  }
  const columnas = [];
  const valores = [];
  if (telefono !== undefined) {
    columnas.push('telefono = ?');
    valores.push(telefono);
  }
  if (especialidad !== undefined) {
    columnas.push('especialidad = ?');
    valores.push(especialidad);
  }
  if (columnas.length === 0) return;
  await conexion.execute(`UPDATE entrenadores SET ${columnas.join(', ')} WHERE id_usuario = ?`, [...valores, idUsuario]);
}

// Asignaciones activas de un entrenador (todas, sin importar el estado del cliente).
export async function contarAsignacionesActivas(idUsuario, conexion = pool) {
  const [filas] = await conexion.execute(
    "SELECT COUNT(*) AS n FROM asignaciones_entrenador WHERE id_entrenador = ? AND estado = 'activa'",
    [idUsuario],
  );
  return Number(filas[0].n);
}

// Clientes con asignación activa a este entrenador (FR-008).
export async function clientesAsignados(idUsuario) {
  const [filas] = await pool.execute(
    `SELECT c.id_cliente, c.nombre, c.apellido, c.estado, a.fecha_inicio AS desde
       FROM asignaciones_entrenador a
       JOIN clientes c ON c.id_cliente = a.id_cliente
      WHERE a.id_entrenador = ? AND a.estado = 'activa'
      ORDER BY c.apellido, c.nombre, c.id_cliente`,
    [idUsuario],
  );
  return filas;
}
