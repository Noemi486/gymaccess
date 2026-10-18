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

const escaparLike = (texto) => texto.replace(/[\\%_]/g, '\\$&');

// Lista paginada del más reciente al más antiguo (fecha, hora e id). Unión con `clientes` (el cliente puede ser NULL).
// Los rangos van directamente sobre `fecha` para aprovechar el índice idx_accesos_fecha. `q` busca en nombre,
// apellido y "nombre apellido" del cliente. Todo parametrizado. Devuelve { filas, total }.
export async function listar({ desde, hasta, resultado, q, limit, offset }) {
  const condiciones = [];
  const valores = [];
  if (desde) {
    condiciones.push('a.fecha >= ?');
    valores.push(desde);
  }
  if (hasta) {
    condiciones.push('a.fecha <= ?');
    valores.push(hasta);
  }
  if (resultado) {
    condiciones.push('a.resultado = ?');
    valores.push(resultado);
  }
  if (q) {
    const patron = `%${escaparLike(q)}%`;
    condiciones.push("(c.nombre LIKE ? OR c.apellido LIKE ? OR CONCAT_WS(' ', c.nombre, c.apellido) LIKE ?)");
    valores.push(patron, patron, patron);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const desdeTabla = 'FROM accesos a LEFT JOIN clientes c ON c.id_cliente = a.id_cliente';

  const [conteo] = await pool.execute(`SELECT COUNT(*) AS total ${desdeTabla} ${where}`, valores);
  // LIMIT y OFFSET como texto: mysql2 los envía así en las sentencias preparadas.
  const [filas] = await pool.execute(
    `SELECT a.id_acceso, a.id_cliente, a.fecha, a.hora, a.tipo, a.resultado, a.motivo_rechazo,
            c.nombre AS cliente_nombre, c.apellido AS cliente_apellido
     ${desdeTabla} ${where}
     ORDER BY a.fecha DESC, a.hora DESC, a.id_acceso DESC LIMIT ? OFFSET ?`,
    [...valores, String(limit), String(offset)],
  );
  return { filas, total: Number(conteo[0].total) };
}
