import { pool } from '../config/db.js';

// Acceso a la tabla `rostros`. Solo SELECT / INSERT / UPDATE y siempre con parámetros (?).
// El descriptor (BLOB cifrado) solo se lee en `listarActivosConCliente`, para identificar; el resto de las
// consultas nunca lo selecciona. Nada se borra: desactivar conserva la fila.

const COLUMNAS_PUBLICAS = 'id_rostro, id_cliente, fecha_registro, estado';

export async function listarPorCliente(idCliente, conexion = pool) {
  const [filas] = await conexion.execute(
    `SELECT ${COLUMNAS_PUBLICAS} FROM rostros WHERE id_cliente = ? ORDER BY fecha_registro DESC, id_rostro DESC`,
    [idCliente],
  );
  return filas;
}

export async function buscarPorId(id, conexion = pool, { bloquear = false } = {}) {
  const [filas] = await conexion.execute(
    `SELECT ${COLUMNAS_PUBLICAS} FROM rostros WHERE id_rostro = ? LIMIT 1${bloquear ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return filas[0] ?? null;
}

// Rostros activos con su cliente (también los de clientes dados de baja, para poder informar el motivo).
export async function listarActivosConCliente(conexion = pool) {
  const [filas] = await conexion.execute(
    `SELECT r.id_rostro, r.id_cliente, r.descriptor_facial, c.estado AS cliente_estado
     FROM rostros r JOIN clientes c ON c.id_cliente = r.id_cliente
     WHERE r.estado = 'activo'`,
  );
  return filas;
}

export async function insertar({ id_cliente, descriptor_facial }, conexion = pool) {
  const [r] = await conexion.execute("INSERT INTO rostros (id_cliente, descriptor_facial, estado) VALUES (?, ?, 'activo')", [
    id_cliente,
    descriptor_facial,
  ]);
  return r.insertId;
}

export async function cambiarEstado(id, estado, conexion = pool) {
  await conexion.execute('UPDATE rostros SET estado = ? WHERE id_rostro = ?', [estado, id]);
}

// Deja inactivos todos los rostros activos del cliente. Devuelve cuántos eran.
// Se actualiza por clave primaria (no por `id_cliente`): un UPDATE por el índice bloquea rangos y provoca
// interbloqueos cuando se registran rostros de clientes distintos a la vez. Quien llama ya tiene bloqueada
// la fila del cliente, así que nadie más cambia los rostros de ese cliente mientras tanto.
export async function desactivarActivosDeCliente(idCliente, conexion = pool) {
  const [activos] = await conexion.execute("SELECT id_rostro FROM rostros WHERE id_cliente = ? AND estado = 'activo'", [idCliente]);
  if (activos.length === 0) return 0;
  const ids = activos.map((fila) => fila.id_rostro);
  const marcas = ids.map(() => '?').join(', ');
  const [r] = await conexion.execute(`UPDATE rostros SET estado = 'inactivo' WHERE id_rostro IN (${marcas})`, ids);
  return r.affectedRows;
}
