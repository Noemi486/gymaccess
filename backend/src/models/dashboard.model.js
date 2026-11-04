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

// ---------------------------------------------------------------------------------------------
// Sprint 3 (spec 004, US6, FR-021 a FR-023): entrenamiento. Todo se calcula en el momento (sin tablas de estadísticas).
// `soloEntrenadores` limita a esos entrenadores y a sus clientes; lo usan las pruebas para no depender de otros datos.
// ---------------------------------------------------------------------------------------------

function filtroLista(columna, ids, valores) {
  if (!ids) return '';
  if (ids.length === 0) return ' AND 1 = 0';
  valores.push(...ids);
  return ` AND ${columna} IN (${ids.map(() => '?').join(', ')})`;
}

// Asignación activa de un cliente activo (base de "clientes con entrenador").
const ASIGNADOS = `FROM asignaciones_entrenador a JOIN clientes c ON c.id_cliente = a.id_cliente
                   WHERE a.estado = 'activa' AND c.estado = 'activo'`;

export async function entrenamiento({ desde, hasta, soloEntrenadores } = {}) {
  const v1 = [];
  const fEnt = filtroLista('u.id_usuario', soloEntrenadores, v1);
  const [[entrenadores]] = await pool.execute(
    `SELECT COUNT(*) AS n FROM usuarios u WHERE u.rol = 'entrenador' AND u.estado = 'activo'${fEnt}`,
    v1,
  );

  const v2 = [];
  const fAsig = filtroLista('a.id_entrenador', soloEntrenadores, v2);
  const v3 = [desde, hasta];
  const fAsig3 = filtroLista('a.id_entrenador', soloEntrenadores, v3);
  const [[r]] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) ${ASIGNADOS}${fAsig}) AS con_entrenador,
       (SELECT COUNT(*) FROM rutinas r JOIN asignaciones_entrenador a ON a.id_cliente = r.id_cliente AND a.estado = 'activa'
          JOIN clientes c ON c.id_cliente = r.id_cliente
         WHERE r.estado = 'activa' AND c.estado = 'activo'${fAsig}) AS rutinas_activas,
       (SELECT COUNT(*) FROM objetivos_entrenamiento o JOIN asignaciones_entrenador a ON a.id_cliente = o.id_cliente AND a.estado = 'activa'
          JOIN clientes c ON c.id_cliente = o.id_cliente
         WHERE o.estado = 'en_curso' AND c.estado = 'activo'${fAsig}) AS objetivos_en_curso,
       (SELECT COUNT(*) ${ASIGNADOS}${fAsig}
           AND EXISTS (SELECT 1 FROM progresos_clientes p WHERE p.id_cliente = a.id_cliente
                        AND p.fecha >= DATE_SUB(CURDATE(), INTERVAL 29 DAY))) AS con_avance_30_dias`,
    [...v2, ...v2, ...v2, ...v2],
  );
  const [[cumplidos]] = await pool.execute(
    `SELECT COUNT(*) AS n FROM objetivos_entrenamiento o JOIN asignaciones_entrenador a ON a.id_cliente = o.id_cliente AND a.estado = 'activa'
      WHERE o.estado = 'cumplido' AND o.fecha_cierre >= ? AND o.fecha_cierre < DATE_ADD(?, INTERVAL 1 DAY)${fAsig3}`,
    [v3[0] + ' 00:00:00', ...v3.slice(1)],
  );

  // Clientes activos sin asignación activa (no depende de soloEntrenadores: es del gimnasio completo).
  const [[sin]] = await pool.execute(
    `SELECT COUNT(*) AS n FROM clientes c WHERE c.estado = 'activo'
       AND NOT EXISTS (SELECT 1 FROM asignaciones_entrenador a WHERE a.id_cliente = c.id_cliente AND a.estado = 'activa')`,
  );

  const v4 = [desde, hasta];
  const fCarga = filtroLista('u.id_usuario', soloEntrenadores, v4);
  const [carga] = await pool.execute(
    `SELECT u.id_usuario, u.nombre,
            (SELECT COUNT(*) ${ASIGNADOS} AND a.id_entrenador = u.id_usuario) AS clientes_asignados,
            (SELECT COUNT(*) FROM rutinas r JOIN asignaciones_entrenador a ON a.id_cliente = r.id_cliente AND a.estado = 'activa'
               JOIN clientes c ON c.id_cliente = r.id_cliente
              WHERE r.estado = 'activa' AND c.estado = 'activo' AND a.id_entrenador = u.id_usuario) AS rutinas_activas,
            (SELECT COUNT(*) FROM progresos_clientes p WHERE p.id_entrenador = u.id_usuario
                AND p.fecha_registro >= ? AND p.fecha_registro < DATE_ADD(?, INTERVAL 1 DAY)) AS avances_periodo
       FROM usuarios u
      WHERE u.rol = 'entrenador' AND u.estado = 'activo'${fCarga}
      ORDER BY clientes_asignados DESC, u.nombre, u.id_usuario`,
    [v4[0] + ' 00:00:00', ...v4.slice(1)],
  );

  return {
    entrenadores_activos: Number(entrenadores.n),
    clientes_con_entrenador: Number(r.con_entrenador),
    clientes_sin_entrenador: Number(sin.n),
    rutinas_activas: Number(r.rutinas_activas),
    objetivos_en_curso: Number(r.objetivos_en_curso),
    objetivos_cumplidos_periodo: Number(cumplidos.n),
    con_avance_30_dias: Number(r.con_avance_30_dias),
    carga: carga.map((f) => ({
      id_usuario: f.id_usuario,
      nombre: f.nombre,
      clientes_asignados: Number(f.clientes_asignados),
      rutinas_activas: Number(f.rutinas_activas),
      avances_periodo: Number(f.avances_periodo),
    })),
  };
}
