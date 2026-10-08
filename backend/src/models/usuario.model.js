import { pool } from '../config/db.js';

// Acceso a la tabla `usuarios`. Solo SELECT / INSERT / UPDATE y siempre con parámetros (?).
// Los métodos que reciben `conexion` participan en una transacción (ver conTransaccion);
// sin ella usan el pool.
// Devuelve la fila completa (incluye `password`, el hash bcrypt): quien la use debe
// pasarla por `usuarioPublico` antes de responder al cliente.

// Columnas que se pueden modificar con `actualizar` (lista cerrada: nunca viene del usuario).
const COLUMNAS_EDITABLES = ['nombre', 'correo', 'password', 'rol', 'estado'];

// Columnas de las listas: sin `password`.
const COLUMNAS_PUBLICAS =
  'id_usuario, nombre, correo, rol, estado, id_cliente, fecha_registro';

// Además de las columnas del usuario devuelve `estado_cliente`: el estado del cliente vinculado
// (NULL para el personal). Un cliente dado de baja no puede entrar al sistema (FR-003b).
const SELECT_USUARIO_CON_CLIENTE = `
  SELECT u.*, c.estado AS estado_cliente
  FROM usuarios u
  LEFT JOIN clientes c ON c.id_cliente = u.id_cliente`;

export async function buscarPorCorreo(correo, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_USUARIO_CON_CLIENTE} WHERE u.correo = ? LIMIT 1`, [correo]);
  return filas[0] ?? null;
}

// Con `bloquear: true` (dentro de una transacción) solo se bloquea la fila del usuario
// (FOR UPDATE OF u), no la del cliente, hasta el COMMIT.
export async function buscarPorId(id, conexion = pool, { bloquear = false } = {}) {
  const sql = `${SELECT_USUARIO_CON_CLIENTE} WHERE u.id_usuario = ? LIMIT 1${bloquear ? ' FOR UPDATE OF u' : ''}`;
  const [filas] = await conexion.execute(sql, [id]);
  return filas[0] ?? null;
}

export async function buscarPorIdCliente(idCliente, conexion = pool) {
  const [filas] = await conexion.execute('SELECT * FROM usuarios WHERE id_cliente = ? LIMIT 1', [idCliente]);
  return filas[0] ?? null;
}

// Lista paginada con filtros opcionales. Devuelve { filas, total }.
export async function listar({ rol, estado, limit, offset }) {
  const condiciones = [];
  const valores = [];
  if (rol) {
    condiciones.push('rol = ?');
    valores.push(rol);
  }
  if (estado) {
    condiciones.push('estado = ?');
    valores.push(estado);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [conteo] = await pool.execute(`SELECT COUNT(*) AS total FROM usuarios ${where}`, valores);
  // LIMIT y OFFSET como texto: mysql2 los envía así en las sentencias preparadas.
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS_PUBLICAS} FROM usuarios ${where} ORDER BY nombre, id_usuario LIMIT ? OFFSET ?`,
    [...valores, String(limit), String(offset)],
  );
  return { filas, total: Number(conteo[0].total) };
}

// Inserta un usuario y devuelve su id. `datos.password` ya debe ser el hash bcrypt.
export async function crear({ nombre, correo, password, rol, id_cliente = null }, conexion = pool) {
  const [resultado] = await conexion.execute(
    'INSERT INTO usuarios (nombre, correo, password, rol, id_cliente) VALUES (?, ?, ?, ?, ?)',
    [nombre, correo, password, rol, id_cliente],
  );
  return resultado.insertId;
}

// Actualiza solo las columnas permitidas que vengan en `campos`.
export async function actualizar(id, campos, conexion = pool) {
  const columnas = COLUMNAS_EDITABLES.filter((columna) => campos[columna] !== undefined);
  if (columnas.length === 0) return;
  const asignaciones = columnas.map((columna) => `${columna} = ?`).join(', ');
  await conexion.execute(`UPDATE usuarios SET ${asignaciones} WHERE id_usuario = ?`, [
    ...columnas.map((columna) => campos[columna]),
    id,
  ]);
}

// Cuenta los administradores activos y los bloquea hasta el COMMIT (FOR UPDATE), para que dos
// desactivaciones simultáneas no puedan dejar al sistema sin administradores.
export async function contarAdministradoresActivos(conexion) {
  const [filas] = await conexion.execute(
    "SELECT id_usuario FROM usuarios WHERE rol = 'administrador' AND estado = 'activo' FOR UPDATE",
  );
  return filas.length;
}
