import mysql from 'mysql2/promise';
import { env } from './env.js';

// Pool de conexiones con el usuario de aplicación (gymaccess_app).
// Solo tiene SELECT, INSERT y UPDATE: no existe ninguna operación de borrado.
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
});

// Ejecuta `callback(conexion)` dentro de una transacción.
// Hace COMMIT si termina bien y ROLLBACK si lanza un error.
export async function conTransaccion(callback) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await callback(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}
