import { pool } from '../config/db.js';

// Acceso a la tabla `clientes`. Solo SELECT / INSERT / UPDATE y siempre con parámetros (?).
// Los métodos que reciben `conexion` participan en una transacción (ver conTransaccion);
// sin ella usan el pool.

// Columnas que se pueden modificar con `actualizar` (lista cerrada: nunca viene del usuario).
// `estado` se cambia solo con `cambiarEstado` y `fecha_registro` no se modifica nunca.
const COLUMNAS_EDITABLES = ['nombre', 'apellido', 'telefono', 'correo', 'direccion'];

// Con `bloquear: true` (dentro de una transacción) la fila queda bloqueada hasta el COMMIT.
export async function buscarPorId(id, conexion = pool, { bloquear = false } = {}) {
  const sql = `SELECT * FROM clientes WHERE id_cliente = ? LIMIT 1${bloquear ? ' FOR UPDATE' : ''}`;
  const [filas] = await conexion.execute(sql, [id]);
  return filas[0] ?? null;
}

export async function buscarPorCorreo(correo, conexion = pool) {
  const [filas] = await conexion.execute('SELECT * FROM clientes WHERE correo = ? LIMIT 1', [correo]);
  return filas[0] ?? null;
}

// Escapa los comodines de LIKE (% _ \) para que la búsqueda trate el texto como literal.
const escaparLike = (texto) => texto.replace(/[\\%_]/g, '\\$&');

// Lista paginada ordenada por apellido y nombre (usa el índice idx_clientes_nombre).
// `q` busca en nombre, apellido, "nombre apellido" y, si `buscarEnCorreo`, en el correo.
// El entrenador no ve el correo, así que a él no se le permite buscar por correo
// (si no, podría deducir correos). Devuelve { filas, total }.
export async function listar({ q, estado, limit, offset, buscarEnCorreo = true, paraCuenta = false }) {
  const condiciones = [];
  const valores = [];

  if (q) {
    const patron = `%${escaparLike(q)}%`;
    const campos = ['nombre', 'apellido', "CONCAT_WS(' ', nombre, apellido)"];
    if (buscarEnCorreo) campos.push('correo');
    condiciones.push(`(${campos.map((campo) => `${campo} LIKE ?`).join(' OR ')})`);
    valores.push(...campos.map(() => patron));
  }
  if (estado) {
    condiciones.push('estado = ?');
    valores.push(estado);
  }
  if (paraCuenta) {
    // Disponibles para crear una cuenta de acceso: activos, con correo y sin cuenta vinculada.
    condiciones.push(
      "estado = 'activo'",
      'correo IS NOT NULL',
      'NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id_cliente = clientes.id_cliente)',
    );
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [conteo] = await pool.execute(`SELECT COUNT(*) AS total FROM clientes ${where}`, valores);
  // LIMIT y OFFSET como texto: mysql2 los envía así en las sentencias preparadas.
  const [filas] = await pool.execute(
    `SELECT * FROM clientes ${where} ORDER BY apellido, nombre, id_cliente LIMIT ? OFFSET ?`,
    [...valores, String(limit), String(offset)],
  );
  return { filas, total: Number(conteo[0].total) };
}

// Inserta un cliente y devuelve su id. `correo` y `direccion` pueden ser null.
export async function crear({ nombre, apellido, telefono, correo = null, direccion = null }, conexion = pool) {
  const [resultado] = await conexion.execute(
    'INSERT INTO clientes (nombre, apellido, telefono, correo, direccion) VALUES (?, ?, ?, ?, ?)',
    [nombre, apellido, telefono, correo, direccion],
  );
  return resultado.insertId;
}

// Actualiza solo las columnas permitidas que vengan en `campos` (null es un valor válido para
// correo y dirección; undefined significa "no tocar").
export async function actualizar(id, campos, conexion = pool) {
  const columnas = COLUMNAS_EDITABLES.filter((columna) => campos[columna] !== undefined);
  if (columnas.length === 0) return;
  const asignaciones = columnas.map((columna) => `${columna} = ?`).join(', ');
  await conexion.execute(`UPDATE clientes SET ${asignaciones} WHERE id_cliente = ?`, [
    ...columnas.map((columna) => campos[columna]),
    id,
  ]);
}

// Baja o reactivación lógica: el registro nunca se elimina.
export async function cambiarEstado(id, estado, conexion = pool) {
  await conexion.execute('UPDATE clientes SET estado = ? WHERE id_cliente = ?', [estado, id]);
}
