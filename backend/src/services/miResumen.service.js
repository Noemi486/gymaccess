import * as accesoModeloReal from '../models/acceso.model.js';
import * as fechaModeloReal from '../models/fecha.model.js';
import * as membresiaModeloReal from '../models/membresia.model.js';
import * as pagoModeloReal from '../models/pago.model.js';
import * as rostroModeloReal from '../models/rostro.model.js';
import { aCentavos, deCentavos } from '../utils/dinero.js';
import { errorNoEncontrado, errorSinPermiso } from '../utils/errores.js';
import { cubreHoy, estadoEfectivo } from '../utils/membresia.js';
import { membresiaPublica } from '../utils/serializadores.js';

const CANTIDAD = 5;
const numeroMonto = (valor) => deCentavos(aCentavos(valor));

// Resumen propio del cliente para su Inicio (US9, FR-042). Usa SOLO el id_cliente de la sesión: el cliente
// nunca elige de quién consulta. Sin datos biométricos: del rostro solo se informa si existe y desde cuándo.
export function crearMiResumenService({
  membresiaModelo = membresiaModeloReal,
  rostroModelo = rostroModeloReal,
  accesoModelo = accesoModeloReal,
  pagoModelo = pagoModeloReal,
  fechaModelo = fechaModeloReal,
} = {}) {
  const estadoDe = (fila, hoy) =>
    estadoEfectivo({ estado: fila.estado, fecha_inicio: fila.fecha_inicio, fecha_fin: fila.fecha_fin, tiene_pago: fila.pago_id != null }, hoy);

  // La membresía que se muestra: la en curso (cubre hoy y no está cancelada); si no hay, una pendiente de pago
  // (por ejemplo, una renovación que empieza después); si tampoco, la más reciente.
  function elegirMembresia(filas, hoy) {
    return (
      filas.find((fila) => cubreHoy(fila, hoy) && fila.estado !== 'cancelada') ??
      filas.find((fila) => estadoDe(fila, hoy) === 'pendiente_de_pago') ??
      filas[0] ??
      null
    );
  }

  async function obtener(actor) {
    if (actor?.rol !== 'cliente') throw errorSinPermiso();
    if (actor.id_cliente === undefined || actor.id_cliente === null) throw errorNoEncontrado('Tu cuenta no está vinculada a un cliente.');
    const idCliente = actor.id_cliente;

    const [hoy, filas, rostros, visitas, pagos] = await Promise.all([
      fechaModelo.obtenerHoy(),
      membresiaModelo.listarPorCliente(idCliente),
      rostroModelo.listarPorCliente(idCliente),
      accesoModelo.ultimosDeCliente(idCliente, CANTIDAD),
      pagoModelo.ultimosDeCliente(idCliente, CANTIDAD),
    ]);

    const elegida = elegirMembresia(filas, hoy);
    const membresia = elegida ? membresiaPublica(elegida, hoy) : null;
    const pendiente = filas.find((fila) => estadoDe(fila, hoy) === 'pendiente_de_pago');
    const activo = rostros.find((rostro) => rostro.estado === 'activo');

    return {
      membresia,
      rostro: { registrado: Boolean(activo), fecha_registro: activo?.fecha_registro ?? null },
      visitas: visitas.map((v) => ({ fecha: v.fecha, hora: v.hora, resultado: v.resultado, motivo_rechazo: v.motivo_rechazo ?? null })),
      pagos: pagos.map((p) => ({ fecha_pago: p.fecha_pago, monto: numeroMonto(p.monto), metodo_pago: p.metodo_pago, plan: p.plan })),
      adeudo: pendiente ? { monto: numeroMonto(pendiente.tipo_precio), plan: pendiente.tipo_nombre } : null,
    };
  }

  return { obtener };
}

export const { obtener } = crearMiResumenService();
