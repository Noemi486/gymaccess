import { pool } from '../config/db.js';

// Acceso a la tabla `accesos`. Solo INSERT (cada intento se registra y nunca se borra) y siempre con parámetros (?).
// `fecha` y `hora` usan los valores por defecto de la base y `tipo` queda en 'entrada'.
// Las restricciones de la base se respetan: autorizado => cliente identificado; rechazado => motivo no vacío.
export async function insertar({ id_cliente = null, resultado, motivo_rechazo = null }, conexion = pool) {
  const [r] = await conexion.execute(
    "INSERT INTO accesos (id_cliente, tipo, resultado, motivo_rechazo) VALUES (?, 'entrada', ?, ?)",
    [id_cliente, resultado, motivo_rechazo],
  );
  return r.insertId;
}
