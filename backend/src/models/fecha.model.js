import { pool } from '../config/db.js';

// "Hoy" según la base de datos (CURDATE()), como texto "YYYY-MM-DD".
// Todas las reglas de vigencia usan esta fecha para coincidir con las consultas SQL.
export async function obtenerHoy(conexion = pool) {
  const [filas] = await conexion.execute("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
  return filas[0].hoy;
}
