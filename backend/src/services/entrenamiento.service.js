import { conTransaccion as conTransaccionReal } from '../config/db.js';
import * as asignacionModeloReal from '../models/asignacion.model.js';
import * as clienteModeloReal from '../models/cliente.model.js';
import * as rutinaModeloReal from '../models/rutina.model.js';
import * as auditoriaReal from './auditoria.service.js';
import { MODULOS } from './auditoria.service.js';
import { errorConflicto, errorNoEncontrado, errorSinPermiso } from '../utils/errores.js';
import { rutinaPublica, rutinaResumen } from '../utils/serializadores.js';

// Entrenamiento de un cliente: rutinas (US3), y en la fase siguiente objetivos y avances (US4).
// Permisos (FR-017, FR-018): el entrenador solo con sus clientes asignados hoy; el administrador solo consulta;
// el recepcionista y el cliente no entran aquí (el cliente usa /clientes/me/entrenamiento).
export function crearEntrenamientoService({
  asignacionModelo = asignacionModeloReal,
  clienteModelo = clienteModeloReal,
  rutinaModelo = rutinaModeloReal,
  auditoria = auditoriaReal,
  conTransaccion = conTransaccionReal,
} = {}) {
  // Devuelve el cliente si `actor` puede consultar (o, con `escribir`, registrar) su entrenamiento.
  async function verificarAcceso(actor, idCliente, { escribir = false, conexion, bloquear = false } = {}) {
    const esEntrenador = actor?.rol === 'entrenador';
    if (!esEntrenador && !(actor?.rol === 'administrador' && !escribir)) throw errorSinPermiso();
    const cliente = await clienteModelo.buscarPorId(idCliente, conexion, { bloquear });
    if (!cliente) throw errorNoEncontrado('El cliente no existe.');
    if (esEntrenador) {
      if (!(await asignacionModelo.estaAsignado(actor.id_usuario, idCliente, conexion))) {
        throw errorSinPermiso('Este cliente no está asignado a ti.');
      }
      if (escribir && cliente.estado !== 'activo') throw errorConflicto('El cliente está dado de baja: su entrenamiento solo se puede consultar.');
    }
    return cliente;
  }

  async function rutinaCompleta(fila, conexion) {
    return rutinaPublica(fila, await rutinaModelo.ejerciciosDe(fila.id_rutina, conexion));
  }

  // GET /clientes/:id/entrenamiento
  async function obtener(idCliente, actor) {
    const cliente = await verificarAcceso(actor, idCliente);
    const [asignacion, activa, rutinas] = await Promise.all([
      asignacionModelo.activaDeCliente(idCliente),
      rutinaModelo.activaDeCliente(idCliente),
      rutinaModelo.listarDeCliente(idCliente),
    ]);
    return {
      cliente: { id_cliente: cliente.id_cliente, nombre: cliente.nombre, apellido: cliente.apellido, estado: cliente.estado },
      entrenador: asignacion ? { id_usuario: asignacion.id_entrenador, nombre: asignacion.entrenador_nombre, desde: asignacion.fecha_inicio } : null,
      puede_editar: actor.rol === 'entrenador' && cliente.estado === 'activo',
      rutina_activa: activa ? await rutinaCompleta(activa) : null,
      rutinas: rutinas.map(rutinaResumen),
    };
  }

  // GET /rutinas/:id (activa o archivada)
  async function obtenerRutina(idRutina, actor) {
    const fila = await rutinaModelo.buscarPorId(idRutina);
    if (!fila) throw errorNoEncontrado('La rutina no existe.');
    await verificarAcceso(actor, fila.id_cliente);
    return rutinaCompleta(fila);
  }

  // POST /clientes/:id/rutinas: crea una versión nueva activa y archiva la anterior en la misma transacción (FR-011).
  async function crearRutina(idCliente, { nombre, indicaciones, dias }, actor) {
    const accionInicial = 'crear';
    let accion = accionInicial;
    try {
      const id = await conTransaccion(async (conexion) => {
        await verificarAcceso(actor, idCliente, { escribir: true, conexion, bloquear: true });
        const anterior = await rutinaModelo.activaDeCliente(idCliente, conexion, { bloquear: true });
        if (anterior) {
          accion = 'versionar';
          await rutinaModelo.archivar(anterior.id_rutina, conexion);
        }
        const idRutina = await rutinaModelo.crear(
          { id_cliente: idCliente, id_entrenador: actor.id_usuario, nombre, indicaciones, id_rutina_anterior: anterior?.id_rutina ?? null },
          conexion,
        );
        for (const { dia, ejercicios } of dias) {
          for (const [i, ejercicio] of ejercicios.entries()) await rutinaModelo.insertarEjercicio(idRutina, dia, i + 1, ejercicio, conexion);
        }
        await auditoria.registrarExito(conexion, {
          id_usuario: actor.id_usuario, accion, modulo: MODULOS.RUTINAS,
          descripcion: anterior
            ? `Rutina ${idRutina} creada para el cliente ${idCliente} (reemplaza a la ${anterior.id_rutina}).`
            : `Rutina ${idRutina} creada para el cliente ${idCliente}.`,
        });
        return idRutina;
      });
      return rutinaCompleta(await rutinaModelo.buscarPorId(id));
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        error = errorConflicto('La rutina de este cliente acaba de cambiar. Recarga la página y vuelve a intentarlo.');
      }
      if (error.status === 409) {
        await auditoria.registrarError({
          id_usuario: actor.id_usuario, accion, modulo: MODULOS.RUTINAS, descripcion: `Rutina rechazada para el cliente ${idCliente}.`,
        });
      }
      throw error;
    }
  }

  return { verificarAcceso, obtener, obtenerRutina, crearRutina };
}

export const { verificarAcceso, obtener, obtenerRutina, crearRutina } = crearEntrenamientoService();
