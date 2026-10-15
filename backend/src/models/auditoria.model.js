import { pool } from '../config/db.js';

// Acceso a la tabla `auditoria`. Solo INSERT: los eventos no se modifican ni se eliminan.
export async function insertar({ id_usuario = null, accion, modulo, resultado, descripcion = null }, conexion = pool) {
  const [r] = await conexion.execute(
    'INSERT INTO auditoria (id_usuario, accion, modulo, resultado, descripcion) VALUES (?, ?, ?, ?, ?)',
    [id_usuario, accion, modulo, resultado, descripcion],
  );
  return r.insertId;
}
