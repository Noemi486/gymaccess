import * as dashboardModeloReal from '../models/dashboard.model.js';
import * as fechaModeloReal from '../models/fecha.model.js';
import { aCentavos, deCentavos } from '../utils/dinero.js';
import { errorValidacion } from '../utils/errores.js';
import { diasRestantes, sumarDias } from '../utils/membresia.js';
import { accesoPublico } from '../utils/serializadores.js';

const MAXIMO_DIAS_RANGO = 366;

// Fechas del periodo con la fecha de la base (`hoy`): semana = lunes de esta semana a hoy; mes = día 1 a hoy.
export function resolverPeriodo({ periodo = 'hoy', desde, hasta }, hoy) {
  if (periodo === 'hoy') return { tipo: 'hoy', desde: hoy, hasta: hoy };
  if (periodo === 'semana') {
    const diaSemana = new Date(`${hoy}T00:00:00Z`).getUTCDay(); // 0 = domingo
    return { tipo: 'semana', desde: sumarDias(hoy, -((diaSemana + 6) % 7)), hasta: hoy };
  }
  if (periodo === 'mes') return { tipo: 'mes', desde: `${hoy.slice(0, 8)}01`, hasta: hoy };

  // Rango: el validador ya exige ambas fechas y desde <= hasta; aquí lo que depende de hoy.
  const detalles = [];
  if (hasta > hoy) detalles.push({ field: 'hasta', message: 'El rango no puede incluir fechas futuras.' });
  else if (diasRestantes(hasta, desde) + 1 > MAXIMO_DIAS_RANGO) {
    detalles.push({ field: 'hasta', message: `El rango no puede ser mayor a ${MAXIMO_DIAS_RANGO} días.` });
  }
  if (detalles.length > 0) throw errorValidacion('Revisa el periodo.', detalles);
  return { tipo: 'rango', desde, hasta };
}

export function crearDashboardService({ modelo = dashboardModeloReal, fechaModelo = fechaModeloReal } = {}) {
  // GET /dashboard: estado actual (a la fecha de hoy) y cifras del periodo elegido.
  async function obtener(consulta) {
    const hoy = await fechaModelo.obtenerHoy();
    const periodo = resolverPeriodo(consulta, hoy);
    const [estado_actual, ingresos, accesos, recientes, entrenamiento] = await Promise.all([
      modelo.estadoActual(),
      modelo.ingresos(periodo),
      modelo.accesosPorResultado(periodo),
      modelo.accesosRecientes(periodo),
      modelo.entrenamiento(periodo),
    ]);
    return {
      periodo,
      estado_actual,
      periodo_datos: {
        ingresos: deCentavos(aCentavos(ingresos)),
        accesos_autorizados: accesos.autorizados,
        accesos_rechazados: accesos.rechazados,
      },
      accesos_recientes: recientes.map((fila) => accesoPublico(fila)),
      // Sprint 3 (FR-021, FR-022): porcentaje = clientes asignados con avance en 30 días / clientes con entrenador.
      entrenamiento: {
        ...entrenamiento,
        porcentaje_con_avance:
          entrenamiento.clientes_con_entrenador === 0 ? 0 : Math.round((entrenamiento.con_avance_30_dias * 100) / entrenamiento.clientes_con_entrenador),
      },
    };
  }

  return { obtener };
}

export const { obtener } = crearDashboardService();
