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
