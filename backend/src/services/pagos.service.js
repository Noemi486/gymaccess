import { conTransaccion as conTransaccionReal } from '../config/db.js';
import * as clienteModeloReal from '../models/cliente.model.js';
import * as fechaModeloReal from '../models/fecha.model.js';
import * as membresiaModeloReal from '../models/membresia.model.js';
import * as pagoModeloReal from '../models/pago.model.js';
import * as auditoriaServicio from './auditoria.service.js';
import { MODULOS } from './auditoria.service.js';
import { aCentavos, deCentavos, formatearMonto } from '../utils/dinero.js';
import { errorConflicto, errorNoEncontrado, errorValidacion } from '../utils/errores.js';
import { estadoEfectivo } from '../utils/membresia.js';
import { adeudoPublico, membresiaPublica, pagoPublico } from '../utils/serializadores.js';

// Las dependencias se inyectan para poder probar el servicio sin base de datos.
export function crearPagosService({
  pagoModelo = pagoModeloReal,
  membresiaModelo = membresiaModeloReal,
  clienteModelo = clienteModeloReal,
  fechaModelo = fechaModeloReal,
  auditoria = auditoriaServicio,
  conTransaccion = conTransaccionReal,
} = {}) {
  // Registra el pago de una membresía YA BLOQUEADA (fila con FOR UPDATE) dentro de la transacción en curso.
  // Reglas: no cancelada, vencida, suspendida ni ya pagada; monto igual al precio vigente del plan.
  // `campoMonto` es el nombre del campo para el error de monto ("monto" o "pago.monto" si va anidado).
  async function registrarEnTransaccion(conexion, { fila, metodo_pago, monto, actor, hoy, campoMonto = 'monto' }) {
    if (fila.pago_id != null) throw errorConflicto('La membresía ya está pagada.');
    const estado = estadoEfectivo({ estado: fila.estado, fecha_inicio: fila.fecha_inicio, fecha_fin: fila.fecha_fin, tiene_pago: false }, hoy);
    if (estado === 'cancelada') throw errorConflicto('La membresía está cancelada: no admite pagos.');
    if (estado === 'vencida') throw errorConflicto('La membresía ya venció: no admite pagos.');
    if (estado === 'suspendida') throw errorConflicto('La membresía está suspendida: reactívala antes de registrar el pago.');

    const precio = aCentavos(fila.tipo_precio);
    if (aCentavos(monto) !== precio) {
      throw errorValidacion('Revisa los datos enviados.', [
        { field: campoMonto, message: `El pago debe ser por el monto completo: ${formatearMonto(precio)}.` },
      ]);
    }

    const id = await pagoModelo.crear(
      { id_cliente: fila.id_cliente, id_membresia: fila.id_membresia, monto, metodo_pago, id_usuario: actor.id_usuario },
      conexion,
    );
    await auditoria.registrarExito(conexion, {
      id_usuario: actor.id_usuario,
      accion: 'registrar',
      modulo: MODULOS.PAGOS,
      descripcion: `Pago ${id} de la membresía ${fila.id_membresia} (cliente ${fila.id_cliente}).`,
    });
    return id;
  }

  // POST /pagos
  async function registrar({ id_membresia, metodo_pago, monto }, actor) {
    try {
      return await conTransaccion(async (conexion) => {
        // Fuera de la transacción (pool): una lectura dentro de ella fijaría la instantánea antes de bloquear
        // y no vería los cambios que otra transacción confirme mientras esperamos el bloqueo.
        const previa = await membresiaModelo.buscarPorId(id_membresia);
        if (!previa) throw errorNoEncontrado('La membresía no existe.');
        await clienteModelo.buscarPorId(previa.id_cliente, conexion, { bloquear: true });
        const fila = await membresiaModelo.buscarPorId(id_membresia, conexion, { bloquear: true });
        const hoy = await fechaModelo.obtenerHoy(conexion);

        await registrarEnTransaccion(conexion, { fila, metodo_pago, monto, actor, hoy });
        const membresia = membresiaPublica(await membresiaModelo.buscarPorId(id_membresia, conexion), hoy);
        return { pago: membresia.pago, membresia };
      });
    } catch (error) {
      if (error.status === 409) {
        await auditoria.registrarError({
          id_usuario: actor.id_usuario,
          accion: 'registrar',
          modulo: MODULOS.PAGOS,
          descripcion: `Pago rechazado para la membresía ${id_membresia}.`,
        });
      }
      throw error;
    }
  }

  // GET /pagos: historial con el total de lo filtrado (en centavos para no acumular errores de decimales).
  async function listar({ desde, hasta, metodo_pago, q, page, limit, offset }) {
    const { filas, total, total_monto } = await pagoModelo.listar({ desde, hasta, metodo_pago, q, limit, offset });
    return { data: filas.map(pagoPublico), page, limit, total, total_monto: deCentavos(aCentavos(total_monto)) };
  }

  // GET /adeudos: membresías pendientes de pago, la fecha de inicio más antigua primero.
  async function listarAdeudos({ q, page, limit, offset }) {
    const { filas, total, total_adeudo } = await pagoModelo.listarAdeudos({ q, limit, offset });
    return { data: filas.map(adeudoPublico), page, limit, total, total_adeudo: deCentavos(aCentavos(total_adeudo)) };
  }

  return { registrar, registrarEnTransaccion, listar, listarAdeudos };
}

export const { registrar, registrarEnTransaccion, listar, listarAdeudos } = crearPagosService();
