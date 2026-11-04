import { conTransaccion as conTransaccionReal } from '../config/db.js';
import * as asignacionModeloReal from '../models/asignacion.model.js';
import * as clienteModeloReal from '../models/cliente.model.js';
import * as usuarioModeloReal from '../models/usuario.model.js';
import * as auditoriaReal from './auditoria.service.js';
import { MODULOS } from './auditoria.service.js';
import { errorConflicto, errorNoEncontrado, errorSinPermiso } from '../utils/errores.js';

const asignacionPublica = (f) => ({
  id_asignacion: f.id_asignacion,
  entrenador: { id_usuario: f.id_entrenador, nombre: f.entrenador_nombre, estado: f.entrenador_estado },
  fecha_inicio: f.fecha_inicio,
  fecha_fin: f.fecha_fin ?? null,
  estado: f.estado,
});

const conflictoCampo = (mensaje) => errorConflicto(mensaje, [{ field: 'id_entrenador', message: mensaje }]);

// Asignar, cambiar y quitar el entrenador de un cliente (spec 004, US2, FR-005 a FR-007) y "Mis clientes" (US7).
export function crearAsignacionesService({
  modelo = asignacionModeloReal,
  clienteModelo = clienteModeloReal,
  usuarioModelo = usuarioModeloReal,
  auditoria = auditoriaReal,
  conTransaccion = conTransaccionReal,
} = {}) {
  async function obtener(idCliente) {
    const cliente = await clienteModelo.buscarPorId(idCliente);
    if (!cliente) throw errorNoEncontrado('El cliente no existe.');
    const historial = await modelo.historialDeCliente(idCliente);
    const activa = historial.find((f) => f.estado === 'activa');
    return { actual: activa ? asignacionPublica(activa) : null, historial: historial.map(asignacionPublica) };
  }

  // `idEntrenador` asigna o cambia; null quita. Todo en una transacción con la fila del cliente bloqueada,
  // y la base impide dos activas aunque lleguen dos peticiones a la vez (FR-006).
  async function asignar(idCliente, idEntrenador, actor) {
    let accion = idEntrenador === null ? 'quitar' : 'asignar';
    try {
      await conTransaccion(async (conexion) => {
        const cliente = await clienteModelo.buscarPorId(idCliente, conexion, { bloquear: true });
        if (!cliente) throw errorNoEncontrado('El cliente no existe.');
        const actual = await modelo.activaDeCliente(idCliente, conexion);

        if (idEntrenador === null) {
          if (!actual) throw errorConflicto('El cliente no tiene entrenador asignado.');
          await modelo.finalizarActiva(idCliente, conexion);
          await auditoria.registrarExito(conexion, {
            id_usuario: actor.id_usuario, accion, modulo: MODULOS.ASIGNACIONES,
            descripcion: `Cliente ${idCliente} sin entrenador (antes: entrenador ${actual.id_entrenador}).`,
          });
          return;
        }

        if (cliente.estado !== 'activo') throw errorConflicto('No se puede asignar entrenador a un cliente dado de baja.');
        const entrenador = await usuarioModelo.buscarPorId(idEntrenador, conexion);
        if (!entrenador || entrenador.rol !== 'entrenador') throw conflictoCampo('La cuenta elegida no es de un entrenador.');
        if (entrenador.estado !== 'activo') throw conflictoCampo('El entrenador elegido está inactivo.');
        if (actual?.id_entrenador === idEntrenador) throw conflictoCampo('El cliente ya tiene asignado a ese entrenador.');

        if (actual) {
          accion = 'cambiar';
          await modelo.finalizarActiva(idCliente, conexion);
        }
        await modelo.crear({ id_cliente: idCliente, id_entrenador: idEntrenador, id_usuario: actor.id_usuario }, conexion);
        await auditoria.registrarExito(conexion, {
          id_usuario: actor.id_usuario, accion, modulo: MODULOS.ASIGNACIONES,
          descripcion: actual
            ? `Cliente ${idCliente}: entrenador ${actual.id_entrenador} cambiado por ${idEntrenador}.`
            : `Cliente ${idCliente} asignado al entrenador ${idEntrenador}.`,
        });
      });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        error = errorConflicto('El entrenador de este cliente acaba de cambiar. Recarga la página y vuelve a intentarlo.');
      }
      if (error.status === 409) {
        await auditoria.registrarError({
          id_usuario: actor.id_usuario, accion, modulo: MODULOS.ASIGNACIONES,
          descripcion: `Asignación rechazada para el cliente ${idCliente}.`,
        });
      }
      throw error;
    }
    return obtener(idCliente);
  }

  async function misClientes(actor, { q, page, limit, offset }) {
    if (actor?.rol !== 'entrenador') throw errorSinPermiso();
    const { filas, total } = await modelo.misClientes({ idEntrenador: actor.id_usuario, q, limit, offset });
    return { data: filas, page, limit, total };
  }

  return { obtener, asignar, misClientes };
}

export const { obtener, asignar, misClientes } = crearAsignacionesService();
