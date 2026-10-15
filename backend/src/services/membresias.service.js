import { conTransaccion as conTransaccionReal } from '../config/db.js';
import * as clienteModeloReal from '../models/cliente.model.js';
import * as fechaModeloReal from '../models/fecha.model.js';
import * as membresiaModeloReal from '../models/membresia.model.js';
import * as tipoModeloReal from '../models/tipoMembresia.model.js';
import * as auditoriaServicio from './auditoria.service.js';
import { MODULOS } from './auditoria.service.js';
import { aCentavos } from '../utils/dinero.js';
import { errorConflicto, errorNoEncontrado, errorValidacion } from '../utils/errores.js';
import { calcularFechaFin, cubreHoy, estadoEfectivo, sumarDias } from '../utils/membresia.js';
import { membresiaPublica } from '../utils/serializadores.js';

const MAX_DIAS_ADELANTO = 60;
const MAX_HISTORIAL = 50;

// Estado efectivo de una fila de la base (la fila trae pago_id si hay pago registrado).
const estadoDe = (fila, hoy) =>
  estadoEfectivo(
    { estado: fila.estado, fecha_inicio: fila.fecha_inicio, fecha_fin: fila.fecha_fin, tiene_pago: fila.pago_id != null },
    hoy,
  );

// Vencida y cancelada ya no ocupan el lugar de "en curso" ni de "renovación futura".
const ocupaLugar = (fila, hoy) => {
  const estado = estadoDe(fila, hoy);
  return estado !== 'vencida' && estado !== 'cancelada';
};

const errorFecha = (mensaje) => errorValidacion('Revisa los datos enviados.', [{ field: 'fecha_inicio', message: mensaje }]);

// Las dependencias se inyectan para poder probar el servicio sin base de datos.
export function crearMembresiasService({
  modelo = membresiaModeloReal,
  clienteModelo = clienteModeloReal,
  tipoModelo = tipoModeloReal,
  fechaModelo = fechaModeloReal,
  auditoria = auditoriaServicio,
  conTransaccion = conTransaccionReal,
} = {}) {
  // La fecha de inicio indicada debe estar entre hoy y 60 días después.
  function validarFechaInicio(fecha, hoy) {
    if (fecha < hoy) throw errorFecha('La fecha de inicio no puede ser anterior a hoy.');
    if (fecha > sumarDias(hoy, MAX_DIAS_ADELANTO)) {
      throw errorFecha(`La fecha de inicio no puede ser posterior a ${MAX_DIAS_ADELANTO} días desde hoy.`);
    }
  }

  async function cargarClienteActivo(idCliente, conexion) {
    const cliente = await clienteModelo.buscarPorId(idCliente, conexion, { bloquear: true });
    if (!cliente) throw errorNoEncontrado('El cliente no existe.');
    if (cliente.estado !== 'activo') throw errorConflicto('El cliente está dado de baja: no se le pueden asignar membresías.');
    return cliente;
  }

  function validarPlanDisponible(tipo) {
    if (!tipo) throw errorNoEncontrado('El plan de membresía no existe.');
    if (tipo.estado !== 'activo') throw errorConflicto('El plan de membresía está inactivo.');
    if (aCentavos(tipo.precio) <= 0) throw errorConflicto('El plan de membresía no tiene un precio válido.');
  }

  async function auditar(conexion, actor, accion, descripcion) {
    await auditoria.registrarExito(conexion, { id_usuario: actor.id_usuario, accion, modulo: MODULOS.MEMBRESIAS, descripcion });
  }

  async function registrarFallo(actor, accion, descripcion) {
    await auditoria.registrarError({ id_usuario: actor.id_usuario, accion, modulo: MODULOS.MEMBRESIAS, descripcion });
  }

  // GET /clientes/:id/membresias
  async function listarDeCliente(idCliente) {
    const cliente = await clienteModelo.buscarPorId(idCliente);
    if (!cliente) throw errorNoEncontrado('El cliente no existe.');
    const hoy = await fechaModelo.obtenerHoy();
    const filas = await modelo.listarPorCliente(idCliente);

    // Candidatas a "actual" y "próxima": las que aún no vencieron ni se cancelaron, de la más antigua a la más nueva.
    const candidatas = filas.filter((fila) => ocupaLugar(fila, hoy)).reverse();
    const actual = candidatas.find((fila) => cubreHoy(fila, hoy)) ?? null;
    const proxima = candidatas.find((fila) => fila !== actual && fila.fecha_inicio > hoy) ?? null;
    const historial = filas.filter((fila) => fila !== actual && fila !== proxima).slice(0, MAX_HISTORIAL);

    const publica = (fila) => (fila ? membresiaPublica(fila, hoy) : null);
    return { actual: publica(actual), proxima: publica(proxima), historial: historial.map(publica) };
  }

  // POST /clientes/:id/membresias
  async function asignar(idCliente, { id_tipo_membresia, fecha_inicio }, actor) {
    try {
      return await conTransaccion(async (conexion) => {
        await cargarClienteActivo(idCliente, conexion);
        const tipo = await tipoModelo.buscarPorId(id_tipo_membresia, conexion);
        validarPlanDisponible(tipo);

        const hoy = await fechaModelo.obtenerHoy(conexion);
        const inicio = fecha_inicio ?? hoy;
        validarFechaInicio(inicio, hoy);

        const vigentes = (await modelo.listarPorCliente(idCliente, conexion, { bloquear: true })).filter((fila) => ocupaLugar(fila, hoy));
        if (vigentes.length > 0) {
          const estados = vigentes.map((fila) => estadoDe(fila, hoy));
          if (estados.includes('pendiente_de_pago')) {
            throw errorConflicto('El cliente tiene una membresía pendiente de pago. Registra el pago o cancélala antes de asignar otra.');
          }
          if (estados.includes('suspendida')) {
            throw errorConflicto('El cliente tiene una membresía suspendida. Un administrador debe reactivarla o cancelarla.');
          }
          throw errorConflicto('El cliente ya tiene una membresía vigente o programada. Usa la renovación para extenderla.');
        }

        const id = await modelo.crear(
          { id_cliente: idCliente, id_tipo_membresia, fecha_inicio: inicio, fecha_fin: calcularFechaFin(inicio, tipo.duracion) },
          conexion,
        );
        await auditar(conexion, actor, 'asignar', `Membresía ${id} asignada al cliente ${idCliente} (plan ${id_tipo_membresia}).`);
        return { membresia: membresiaPublica(await modelo.buscarPorId(id, conexion), hoy), pago: null };
      });
    } catch (error) {
      if (error.status === 409) await registrarFallo(actor, 'asignar', `Asignación rechazada para el cliente ${idCliente}.`);
      throw error;
    }
  }

  // POST /membresias/:id/renovar
  async function renovar(idMembresia, { fecha_inicio }, actor) {
    try {
      return await conTransaccion(async (conexion) => {
        const previa = await modelo.buscarPorId(idMembresia, conexion);
        if (!previa) throw errorNoEncontrado('La membresía no existe.');
        const idCliente = previa.id_cliente;

        // Se bloquea primero al cliente (igual que al asignar) para serializar operaciones sobre él.
        await cargarClienteActivo(idCliente, conexion);
        const base = await modelo.buscarPorId(idMembresia, conexion, { bloquear: true });
        const tipo = await tipoModelo.buscarPorId(base.id_tipo_membresia, conexion);
        validarPlanDisponible(tipo);

        const hoy = await fechaModelo.obtenerHoy(conexion);
        const estadoBase = estadoDe(base, hoy);
        const otras = (await modelo.listarPorCliente(idCliente, conexion, { bloquear: true })).filter(
          (fila) => fila.id_membresia !== base.id_membresia && ocupaLugar(fila, hoy),
        );

        let inicio;
        if (estadoBase === 'cancelada') throw errorConflicto('No se puede renovar una membresía cancelada.');
        if (estadoBase === 'suspendida') throw errorConflicto('No se puede renovar una membresía suspendida.');
        if (estadoBase === 'pendiente_de_pago') {
          throw errorConflicto('La membresía está pendiente de pago. Regístrala como pagada antes de renovar.');
        }
        if (estadoBase === 'proxima') {
          throw errorConflicto('Esa membresía aún no empieza. Renueva la que está en curso.');
        }

        if (estadoBase === 'vigente') {
          if (otras.length > 0) throw errorConflicto('El cliente ya tiene una renovación programada.');
          inicio = sumarDias(base.fecha_fin, 1);
          if (fecha_inicio !== undefined && fecha_inicio !== inicio) {
            throw errorFecha(`La renovación empieza el día siguiente al fin de la membresía vigente (${inicio}).`);
          }
        } else {
          // Vencida: se renueva desde hoy o desde la fecha indicada, siempre que no haya otra en curso.
          if (otras.length > 0) {
            const pendiente = otras.some((fila) => estadoDe(fila, hoy) === 'pendiente_de_pago');
            throw errorConflicto(
              pendiente
                ? 'El cliente tiene una membresía pendiente de pago. Registra el pago o cancélala antes de renovar.'
                : 'El cliente ya tiene otra membresía en curso o programada.',
            );
          }
          inicio = fecha_inicio ?? hoy;
          validarFechaInicio(inicio, hoy);
        }

        const id = await modelo.crear(
          {
            id_cliente: idCliente,
            id_tipo_membresia: base.id_tipo_membresia,
            fecha_inicio: inicio,
            fecha_fin: calcularFechaFin(inicio, tipo.duracion),
          },
          conexion,
        );
        await auditar(conexion, actor, 'renovar', `Membresía ${idMembresia} renovada como ${id} (cliente ${idCliente}).`);
        return { membresia: membresiaPublica(await modelo.buscarPorId(id, conexion), hoy), pago: null };
      });
    } catch (error) {
      if (error.status === 409) await registrarFallo(actor, 'renovar', `Renovación rechazada para la membresía ${idMembresia}.`);
      throw error;
    }
  }

  // PATCH /membresias/:id/estado (solo administrador; lo exige la ruta)
  async function cambiarEstado(idMembresia, accion, actor) {
    try {
      return await conTransaccion(async (conexion) => {
        const previa = await modelo.buscarPorId(idMembresia, conexion);
        if (!previa) throw errorNoEncontrado('La membresía no existe.');
        await clienteModelo.buscarPorId(previa.id_cliente, conexion, { bloquear: true });
        const fila = await modelo.buscarPorId(idMembresia, conexion, { bloquear: true });

        const hoy = await fechaModelo.obtenerHoy(conexion);
        const estado = estadoDe(fila, hoy);

        let nuevo;
        if (accion === 'suspender') {
          if (estado === 'suspendida') throw errorConflicto('La membresía ya está suspendida.');
          if (estado === 'cancelada') throw errorConflicto('La membresía está cancelada.');
          if (estado === 'vencida') throw errorConflicto('La membresía ya venció: no se puede suspender.');
          nuevo = 'suspendida';
        } else if (accion === 'reactivar') {
          if (fila.estado !== 'suspendida') throw errorConflicto('Solo se pueden reactivar las membresías suspendidas.');
          nuevo = 'activa';
        } else {
          if (estado === 'cancelada') throw errorConflicto('La membresía ya está cancelada.');
          if (estado === 'vencida') throw errorConflicto('La membresía ya venció: no se puede cancelar.');
          nuevo = 'cancelada';
        }

        await modelo.cambiarEstado(idMembresia, nuevo, conexion);
        await auditar(conexion, actor, accion, `Membresía ${idMembresia} (cliente ${fila.id_cliente}): ${accion}.`);
        return membresiaPublica(await modelo.buscarPorId(idMembresia, conexion), hoy);
      });
    } catch (error) {
      if (error.status === 409) await registrarFallo(actor, accion, `Acción ${accion} rechazada para la membresía ${idMembresia}.`);
      throw error;
    }
  }

  return { listarDeCliente, asignar, renovar, cambiarEstado };
}

export const { listarDeCliente, asignar, renovar, cambiarEstado } = crearMembresiasService();
