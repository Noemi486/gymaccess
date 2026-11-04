import { pool } from '../config/db.js';

// Acceso a la tabla `pagos`. No hay UPDATE ni DELETE: un pago registrado no se modifica.

export async function buscarPagoRegistrado(idMembresia, conexion = pool) {
  const [filas] = await conexion.execute("SELECT * FROM pagos WHERE id_membresia = ? AND estado = 'registrado' LIMIT 1", [idMembresia]);
  return filas[0] ?? null;
}

export async function crear({ id_cliente, id_membresia, monto, metodo_pago, id_usuario }, conexion = pool) {
  const [r] = await conexion.execute(
    "INSERT INTO pagos (id_cliente, id_membresia, monto, metodo_pago, estado, id_usuario) VALUES (?, ?, ?, ?, 'registrado', ?)",
    [id_cliente, id_membresia, monto, metodo_pago, id_usuario],
  );
  return r.insertId;
}

const escaparLike = (texto) => texto.replace(/[\\%_]/g, '\\$&');

// Condición de búsqueda por nombre, apellido o "nombre apellido" del cliente (alias c).
function condicionCliente(q, condiciones, valores) {
  if (!q) return;
  const patron = `%${escaparLike(q)}%`;
  condiciones.push("(c.nombre LIKE ? OR c.apellido LIKE ? OR CONCAT_WS(' ', c.nombre, c.apellido) LIKE ?)");
  valores.push(patron, patron, patron);
}

// Historial de pagos registrados, del más reciente al más antiguo. El rango usa `fecha_pago` directamente
// (desde el inicio del primer día hasta antes del día siguiente al último) para aprovechar idx_pagos_fecha.
// Devuelve { filas, total, total_monto } con el total de lo filtrado (no solo de la página).
export async function listar({ desde, hasta, metodo_pago, q, limit, offset }) {
  const condiciones = ["p.estado = 'registrado'"];
  const valores = [];
  if (desde) {
    condiciones.push('p.fecha_pago >= ?');
    valores.push(`${desde} 00:00:00`);
  }
  if (hasta) {
    condiciones.push('p.fecha_pago < DATE_ADD(?, INTERVAL 1 DAY)');
    valores.push(hasta);
  }
  if (metodo_pago) {
    condiciones.push('p.metodo_pago = ?');
    valores.push(metodo_pago);
  }
  condicionCliente(q, condiciones, valores);
  const where = `WHERE ${condiciones.join(' AND ')}`;
  const desdeTabla = `FROM pagos p
    JOIN clientes c ON c.id_cliente = p.id_cliente
    JOIN membresias m ON m.id_membresia = p.id_membresia
    JOIN tipos_membresia t ON t.id_tipo_membresia = m.id_tipo_membresia
    LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario`;

  const [resumen] = await pool.execute(`SELECT COUNT(*) AS total, COALESCE(SUM(p.monto), 0) AS total_monto ${desdeTabla} ${where}`, valores);
  const [filas] = await pool.execute(
    `SELECT p.id_pago, p.fecha_pago, p.id_cliente, p.id_membresia, p.monto, p.metodo_pago,
            c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, t.nombre AS tipo_nombre, u.nombre AS usuario_nombre
     ${desdeTabla} ${where}
     ORDER BY p.fecha_pago DESC, p.id_pago DESC LIMIT ? OFFSET ?`,
    [...valores, String(limit), String(offset)],
  );
  return { filas, total: Number(resumen[0].total), total_monto: resumen[0].total_monto };
}

// Membresías pendientes de pago (estado efectivo `pendiente_de_pago`, data-model.md): guardadas `activa`,
// sin pago registrado y con `fecha_fin` de hoy en adelante. El adeudo es el precio vigente del plan.
// Ordenadas por la fecha de inicio más antigua. Devuelve { filas, total, total_adeudo }.
export async function listarAdeudos({ q, limit, offset }) {
  const condiciones = [
    "m.estado = 'activa'",
    'm.fecha_fin >= CURDATE()',
    "NOT EXISTS (SELECT 1 FROM pagos p WHERE p.id_membresia = m.id_membresia AND p.estado = 'registrado')",
  ];
  const valores = [];
  condicionCliente(q, condiciones, valores);
  const where = `WHERE ${condiciones.join(' AND ')}`;
  const desdeTabla = `FROM membresias m
    JOIN clientes c ON c.id_cliente = m.id_cliente
    JOIN tipos_membresia t ON t.id_tipo_membresia = m.id_tipo_membresia`;

  const [resumen] = await pool.execute(`SELECT COUNT(*) AS total, COALESCE(SUM(t.precio), 0) AS total_adeudo ${desdeTabla} ${where}`, valores);
  const [filas] = await pool.execute(
    `SELECT m.id_membresia, m.id_cliente, m.fecha_inicio, m.fecha_fin, t.nombre AS tipo_nombre, t.precio AS tipo_precio,
            c.nombre AS cliente_nombre, c.apellido AS cliente_apellido
     ${desdeTabla} ${where}
     ORDER BY m.fecha_inicio ASC, m.id_membresia ASC LIMIT ? OFFSET ?`,
    [...valores, String(limit), String(offset)],
  );
  return { filas, total: Number(resumen[0].total), total_adeudo: resumen[0].total_adeudo };
}

// Últimos pagos registrados de un cliente (para su Inicio).
export async function ultimosDeCliente(idCliente, limite) {
  const [filas] = await pool.execute(
    `SELECT p.fecha_pago, p.monto, p.metodo_pago, t.nombre AS plan
     FROM pagos p
     JOIN membresias m ON m.id_membresia = p.id_membresia
     JOIN tipos_membresia t ON t.id_tipo_membresia = m.id_tipo_membresia
     WHERE p.id_cliente = ? AND p.estado = 'registrado'
     ORDER BY p.fecha_pago DESC, p.id_pago DESC LIMIT ?`,
    [idCliente, String(limite)],
  );
  return filas;
}
