import { pool } from '../config/db.js';

// Acceso a la tabla `tipos_membresia`. Solo SELECT / INSERT / UPDATE y siempre con parámetros (?).
// Los métodos con `conexion` participan en una transacción; sin ella usan el pool.

// Columnas que se pueden modificar con `actualizar` (lista cerrada: nunca viene del usuario).
// `estado` se cambia solo con `cambiarEstado`.
const COLUMNAS_EDITABLES = ['nombre', 'descripcion', 'duracion', 'precio'];

// Escapa los comodines de LIKE (% _ \) para que la búsqueda trate el texto como literal.
const escaparLike = (texto) => texto.replace(/[\%_]/g, '\$&');

// Membresías de ese plan pendientes de pago: guardadas como activas, sin pago registrado y que no han vencido.
const PENDIENTES_DE_PAGO = `(
  SELECT COUNT(*) FROM membresias m
  WHERE m.id_tipo_membresia = t.id_tipo_membresia
    AND m.estado = 'activa'
    AND m.fecha_fin >= CURDATE()
    AND NOT EXISTS (
      SELECT 1 FROM pagos p WHERE p.id_membresia = m.id_membresia AND p.estado = 'registrado'
    )
)`;

// Con `bloquear: true` (dentro de una transacción) la fila queda bloqueada hasta el COMMIT.
export async function buscarPorId(id, conexion = pool, { bloquear = false } = {}) {
  const sql = `SELECT t.*, ${PENDIENTES_DE_PAGO} AS membresias_pendientes_de_pago
    FROM tipos_membresia t WHERE t.id_tipo_membresia = ? LIMIT 1${bloquear ? ' FOR UPDATE' : ''}`;
  const [filas] = await conexion.execute(sql, [id]);
  return filas[0] ?? null;
}

// Búsqueda por nombre (la colación de la base ignora mayúsculas y acentos).
export async function buscarPorNombre(nombre, conexion = pool) {
  const [filas] = await conexion.execute('SELECT * FROM tipos_membresia WHERE nombre = ? LIMIT 1', [nombre]);
  return filas[0] ?? null;
}

// Lista paginada ordenada por nombre. Devuelve { filas, total }.
export async function listar({ q, estado, limit, offset }) {
  const condiciones = [];
  const valores = [];
  if (q) {
    condiciones.push('nombre LIKE ?');
    valores.push(`%${escaparLike(q)}%`);
  }
  if (estado) {
    condiciones.push('estado = ?');
    valores.push(estado);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [conteo] = await pool.execute(`SELECT COUNT(*) AS total FROM tipos_membresia ${where}`, valores);
  // LIMIT y OFFSET como texto: mysql2 los envía así en las sentencias preparadas.
  const [filas] = await pool.execute(
    `SELECT * FROM tipos_membresia ${where} ORDER BY nombre, id_tipo_membresia LIMIT ? OFFSET ?`,
    [...valores, String(limit), String(offset)],
  );
  return { filas, total: Number(conteo[0].total) };
}

// Inserta un plan y devuelve su id. `descripcion` puede ser null.
export async function crear({ nombre, descripcion = null, duracion, precio }, conexion = pool) {
  const [r] = await conexion.execute(
    'INSERT INTO tipos_membresia (nombre, descripcion, duracion, precio) VALUES (?, ?, ?, ?)',
    [nombre, descripcion, duracion, precio],
  );
  return r.insertId;
}

// Actualiza solo las columnas permitidas que vengan en `campos` (undefined = no tocar; null es válido en descripcion).
export async function actualizar(id, campos, conexion = pool) {
  const columnas = COLUMNAS_EDITABLES.filter((columna) => campos[columna] !== undefined);
  if (columnas.length === 0) return;
  const asignaciones = columnas.map((columna) => `${columna} = ?`).join(', ');
  await conexion.execute(`UPDATE tipos_membresia SET ${asignaciones} WHERE id_tipo_membresia = ?`, [
    ...columnas.map((columna) => campos[columna]),
    id,
  ]);
}

export async function cambiarEstado(id, estado, conexion = pool) {
  await conexion.execute('UPDATE tipos_membresia SET estado = ? WHERE id_tipo_membresia = ?', [estado, id]);
}
