import { pool } from '../config/db.js';

// Acceso a la tabla `membresias`. Solo SELECT / INSERT / UPDATE y siempre con parámetros (?).
// Cada fila trae el plan y el pago `registrado` (si existe) para calcular el estado efectivo:
// el estado "pendiente de pago" se deriva de que no haya pago; nunca se guarda.
// Con `bloquear: true` (dentro de una transacción) solo se bloquean las filas de `membresias`.

const SELECT_BASE = `SELECT m.*, t.nombre AS tipo_nombre, t.duracion AS tipo_duracion, t.precio AS tipo_precio,
    p.id_pago AS pago_id, p.fecha_pago AS pago_fecha, p.metodo_pago AS pago_metodo, p.monto AS pago_monto
  FROM membresias m
  JOIN tipos_membresia t ON t.id_tipo_membresia = m.id_tipo_membresia
  LEFT JOIN pagos p ON p.id_membresia = m.id_membresia AND p.estado = 'registrado'`;

const BLOQUEO = ' FOR UPDATE OF m';

export async function buscarPorId(id, conexion = pool, { bloquear = false } = {}) {
  const [filas] = await conexion.execute(`${SELECT_BASE} WHERE m.id_membresia = ? LIMIT 1${bloquear ? BLOQUEO : ''}`, [id]);
  return filas[0] ?? null;
}

// Todas las membresías del cliente, de la más reciente a la más antigua.
export async function listarPorCliente(idCliente, conexion = pool, { bloquear = false } = {}) {
  const [filas] = await conexion.execute(
    `${SELECT_BASE} WHERE m.id_cliente = ? ORDER BY m.fecha_inicio DESC, m.id_membresia DESC${bloquear ? BLOQUEO : ''}`,
    [idCliente],
  );
  return filas;
}

// Inserta una membresía (siempre "activa": pendiente/vencida se derivan) y devuelve su id.
export async function crear({ id_cliente, id_tipo_membresia, fecha_inicio, fecha_fin }, conexion = pool) {
  const [r] = await conexion.execute(
    "INSERT INTO membresias (id_cliente, id_tipo_membresia, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?, 'activa')",
    [id_cliente, id_tipo_membresia, fecha_inicio, fecha_fin],
  );
  return r.insertId;
}

// Estados que se guardan: activa, suspendida y cancelada. Nunca "vencida".
export async function cambiarEstado(id, estado, conexion = pool) {
  await conexion.execute('UPDATE membresias SET estado = ? WHERE id_membresia = ?', [estado, id]);
}
