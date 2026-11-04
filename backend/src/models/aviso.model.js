import { pool } from '../config/db.js';

// Avisos de membresías por vencer y vencidas (US12, FR-055, FR-058). Se derivan en el momento de
// membresias, pagos, clientes y tipos_membresia: no hay tabla de avisos. Todo parametrizado.
//   por vencer: membresía vigente (activa, pagada, hoy dentro del periodo) que vence en 0 a 5 días;
//   vencida:    la última membresía pagada (no cancelada) del cliente terminó hace 1 a 7 días.
// En ambos casos se omite si el cliente ya tiene otra membresía activa y pagada que termina después
// (renovación pagada o una nueva vigente). Clientes dados de baja: sin avisos.

const pagada = (alias) =>
  `EXISTS (SELECT 1 FROM pagos p WHERE p.id_membresia = ${alias}.id_membresia AND p.estado = 'registrado')`;

export const DIAS_AVISO_POR_VENCER = 5;
export const DIAS_AVISO_VENCIDA = 7;

export async function listar({ idCliente } = {}) {
  const valores = [DIAS_AVISO_POR_VENCER, DIAS_AVISO_VENCIDA];
  let filtro = '';
  if (idCliente !== undefined && idCliente !== null) {
    filtro = ' AND c.id_cliente = ?';
    valores.push(idCliente);
  }
  const [filas] = await pool.execute(
    `SELECT m.id_membresia,
            DATE_FORMAT(m.fecha_fin, '%Y-%m-%d') AS fecha_fin,
            DATEDIFF(m.fecha_fin, CURDATE()) AS dias,
            t.nombre AS plan,
            c.id_cliente, c.nombre, c.apellido
       FROM membresias m
       JOIN clientes c ON c.id_cliente = m.id_cliente
       JOIN tipos_membresia t ON t.id_tipo_membresia = m.id_tipo_membresia
      WHERE c.estado = 'activo'
        AND ${pagada('m')}
        AND (
              (m.estado = 'activa' AND m.fecha_inicio <= CURDATE()
                 AND m.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY))
           OR (m.estado NOT IN ('cancelada', 'suspendida')
                 AND m.fecha_fin BETWEEN DATE_SUB(CURDATE(), INTERVAL ? DAY) AND DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                 AND m.fecha_fin = (SELECT MAX(u.fecha_fin) FROM membresias u
                                     WHERE u.id_cliente = m.id_cliente AND u.estado <> 'cancelada' AND ${pagada('u')}))
        )
        AND NOT EXISTS (SELECT 1 FROM membresias o
                         WHERE o.id_cliente = m.id_cliente AND o.id_membresia <> m.id_membresia
                           AND o.estado = 'activa' AND o.fecha_fin > m.fecha_fin AND o.fecha_fin >= CURDATE()
                           AND ${pagada('o')})${filtro}
      ORDER BY dias ASC, m.id_membresia ASC`,
    valores,
  );
  return filas;
}
