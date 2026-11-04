import { pool } from '../config/db.js';

// Consultas agregadas del Dashboard (solo lectura, todo parametrizado).
// El estado de cada membresía se calcula en SQL de forma equivalente a utils/membresia.js (estadoEfectivo):
//   vigente = guardada 'activa' + pago registrado + fecha_inicio <= hoy <= fecha_fin.
// `soloClientes` limita las cuentas a esos clientes; lo usan las pruebas para no depender de otros datos.

const PAGADA = "EXISTS (SELECT 1 FROM pagos p WHERE p.id_membresia = m.id_membresia AND p.estado = 'registrado')";

function filtroClientes(soloClientes, valores) {
  if (!soloClientes) return '';
  if (soloClientes.length === 0) return ' AND 1 = 0';
  valores.push(...soloClientes);
  return ` AND c.id_cliente IN (${soloClientes.map(() => '?').join(', ')})`;
}

// Estado actual (no depende del periodo). Categorías excluyentes por cliente activo (FR-040):
//   vigente: tiene una membresía vigente (por_vencer: de esas, la que vence en 0 a 5 días);
//   vencida: no tiene vigente y su última membresía pagada (no cancelada) ya terminó;
//   el resto (sin membresía, solo pendientes de pago o solo una renovación futura) no se cuenta aquí.
export async function estadoActual({ soloClientes } = {}) {
  const valores = [];
  const filtro = filtroClientes(soloClientes, valores);
  const [filas] = await pool.execute(
    `SELECT
       COUNT(*) AS clientes_activos,
       COALESCE(SUM(x.dias_vigente IS NOT NULL), 0) AS con_membresia_vigente,
       COALESCE(SUM(x.dias_vigente BETWEEN 0 AND 5), 0) AS con_membresia_por_vencer,
       COALESCE(SUM(x.dias_vigente IS NULL AND x.ultimo_fin_pagado < CURDATE()), 0) AS con_membresia_vencida
     FROM (
       SELECT c.id_cliente,
         (SELECT MAX(DATEDIFF(m.fecha_fin, CURDATE())) FROM membresias m
           WHERE m.id_cliente = c.id_cliente AND m.estado = 'activa'
             AND m.fecha_inicio <= CURDATE() AND m.fecha_fin >= CURDATE() AND ${PAGADA}) AS dias_vigente,
         (SELECT MAX(m.fecha_fin) FROM membresias m
           WHERE m.id_cliente = c.id_cliente AND m.estado <> 'cancelada' AND ${PAGADA}) AS ultimo_fin_pagado
       FROM clientes c
       WHERE c.estado = 'activo'${filtro}
     ) x`,
    valores,
  );
  const f = filas[0];
  return {
    clientes_activos: Number(f.clientes_activos),
    con_membresia_vigente: Number(f.con_membresia_vigente),
    con_membresia_vencida: Number(f.con_membresia_vencida),
    con_membresia_por_vencer: Number(f.con_membresia_por_vencer),
  };
}

// Suma de pagos registrados del periodo (desde el inicio del primer día hasta antes del día siguiente al último).
export async function ingresos({ desde, hasta }) {
  const [filas] = await pool.execute(
    "SELECT COALESCE(SUM(monto), 0) AS total FROM pagos WHERE estado = 'registrado' AND fecha_pago >= ? AND fecha_pago < DATE_ADD(?, INTERVAL 1 DAY)",
    [`${desde} 00:00:00`, hasta],
  );
  return filas[0].total;
}

// Accesos autorizados y rechazados del periodo (por `fecha`, índice idx_accesos_fecha).
export async function accesosPorResultado({ desde, hasta }) {
  const [filas] = await pool.execute(
    "SELECT COALESCE(SUM(resultado = 'autorizado'), 0) AS autorizados, COALESCE(SUM(resultado = 'rechazado'), 0) AS rechazados FROM accesos WHERE fecha >= ? AND fecha <= ?",
    [desde, hasta],
  );
  return { autorizados: Number(filas[0].autorizados), rechazados: Number(filas[0].rechazados) };
}

// Los 10 accesos más recientes del periodo, con el mismo formato que GET /accesos.
export async function accesosRecientes({ desde, hasta }) {
  const [filas] = await pool.execute(
    `SELECT a.id_acceso, a.id_cliente, a.fecha, a.hora, a.tipo, a.resultado, a.motivo_rechazo,
            c.nombre AS cliente_nombre, c.apellido AS cliente_apellido
     FROM accesos a LEFT JOIN clientes c ON c.id_cliente = a.id_cliente
     WHERE a.fecha >= ? AND a.fecha <= ?
     ORDER BY a.fecha DESC, a.hora DESC, a.id_acceso DESC LIMIT 10`,
    [desde, hasta],
  );
  return filas;
}
