import { conTransaccion as conTransaccionReal } from '../config/db.js';
import * as asignacionModeloReal from '../models/asignacion.model.js';
import * as clienteModeloReal from '../models/cliente.model.js';
import * as fechaModeloReal from '../models/fecha.model.js';
import * as objetivoModeloReal from '../models/objetivo.model.js';
import * as progresoModeloReal from '../models/progreso.model.js';
import * as rutinaModeloReal from '../models/rutina.model.js';
import * as auditoriaReal from './auditoria.service.js';
import { MODULOS } from './auditoria.service.js';
import { errorConflicto, errorNoEncontrado, errorSinPermiso, errorValidacion } from '../utils/errores.js';
import { conDiferencias } from '../utils/progreso.js';
import { objetivoPublico, progresoPublico, rutinaPublica, rutinaResumen } from '../utils/serializadores.js';

// Entrenamiento de un cliente: rutinas (US3), y en la fase siguiente objetivos y avances (US4).
// Permisos (FR-017, FR-018): el entrenador solo con sus clientes asignados hoy; el administrador solo consulta;
// el recepcionista y el cliente no entran aquí (el cliente usa /clientes/me/entrenamiento).
export function crearEntrenamientoService({
  asignacionModelo = asignacionModeloReal,
  clienteModelo = clienteModeloReal,
  rutinaModelo = rutinaModeloReal,
  objetivoModelo = objetivoModeloReal,
  progresoModelo = progresoModeloReal,
  fechaModelo = fechaModeloReal,
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
    const [asignacion, activa, rutinas, objetivos, progresos] = await Promise.all([
      asignacionModelo.activaDeCliente(idCliente),
      rutinaModelo.activaDeCliente(idCliente),
      rutinaModelo.listarDeCliente(idCliente),
      objetivoModelo.listarDeCliente(idCliente),
      progresoModelo.listarDeCliente(idCliente),
    ]);
    return {
      cliente: { id_cliente: cliente.id_cliente, nombre: cliente.nombre, apellido: cliente.apellido, estado: cliente.estado },
      entrenador: asignacion ? { id_usuario: asignacion.id_entrenador, nombre: asignacion.entrenador_nombre, desde: asignacion.fecha_inicio } : null,
      puede_editar: actor.rol === 'entrenador' && cliente.estado === 'activo',
      rutina_activa: activa ? await rutinaCompleta(activa) : null,
      rutinas: rutinas.map(rutinaResumen),
      objetivos: objetivos.map(objetivoPublico),
      progresos: conDiferencias(progresos.map((p) => progresoPublico(p, actor))),
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

  // --- Objetivos (FR-012) ---

  const errorCampo = (campo, mensaje) => errorValidacion('Revisa los datos enviados.', [{ field: campo, message: mensaje }]);
  const auditar = (conexion, actor, modulo, accion, descripcion) =>
    auditoria.registrarExito(conexion, { id_usuario: actor.id_usuario, accion, modulo, descripcion });
  const auditarError = (actor, modulo, accion, descripcion) =>
    auditoria.registrarError({ id_usuario: actor.id_usuario, accion, modulo, descripcion });

  async function revisarFechaLimite(fecha) {
    if (fecha && fecha < (await fechaModelo.obtenerHoy())) throw errorCampo('fecha_limite', 'La fecha límite no puede ser anterior a hoy.');
  }

  async function crearObjetivo(idCliente, datos, actor) {
    await revisarFechaLimite(datos.fecha_limite);
    const id = await conTransaccion(async (conexion) => {
      await verificarAcceso(actor, idCliente, { escribir: true, conexion });
      const idObjetivo = await objetivoModelo.crear({ ...datos, id_cliente: idCliente, id_entrenador: actor.id_usuario }, conexion);
      await auditar(conexion, actor, MODULOS.OBJETIVOS, 'crear', `Objetivo ${idObjetivo} creado para el cliente ${idCliente}.`);
      return idObjetivo;
    });
    return objetivoPublico(await objetivoModelo.buscarPorId(id));
  }

  // PATCH /objetivos/:id: editar (en curso) o cerrar como cumplido o cancelado.
  async function actualizarObjetivo(idObjetivo, cambios, actor) {
    const accion = cambios.estado === 'cumplido' ? 'cumplir' : cambios.estado === 'cancelado' ? 'cancelar' : 'modificar';
    if (cambios.fecha_limite !== undefined) await revisarFechaLimite(cambios.fecha_limite);
    try {
      await conTransaccion(async (conexion) => {
        const objetivo = await objetivoModelo.buscarPorId(idObjetivo, conexion, { bloquear: true });
        if (!objetivo) throw errorNoEncontrado('El objetivo no existe.');
        await verificarAcceso(actor, objetivo.id_cliente, { escribir: true, conexion });
        if (objetivo.estado !== 'en_curso') throw errorConflicto('El objetivo ya está cerrado y no se puede modificar.');
        if (cambios.estado) await objetivoModelo.cerrar(idObjetivo, cambios.estado, conexion);
        else await objetivoModelo.actualizar(idObjetivo, cambios, conexion);
        await auditar(conexion, actor, MODULOS.OBJETIVOS, accion, `Objetivo ${idObjetivo} del cliente ${objetivo.id_cliente}: ${accion}.`);
      });
    } catch (error) {
      if (error.status === 409) await auditarError(actor, MODULOS.OBJETIVOS, accion, `Objetivo ${idObjetivo}: cambio rechazado.`);
      throw error;
    }
    return objetivoPublico(await objetivoModelo.buscarPorId(idObjetivo));
  }

  // --- Avances (FR-013, FR-014) ---

  const fechaLocal = (valor) => {
    if (typeof valor === 'string') return valor.slice(0, 10);
    const d = new Date(valor);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  async function revisarFechaAvance(fecha, cliente) {
    if (fecha > (await fechaModelo.obtenerHoy())) throw errorCampo('fecha', 'La fecha del avance no puede ser futura.');
    if (fecha < fechaLocal(cliente.fecha_registro)) throw errorCampo('fecha', 'La fecha del avance no puede ser anterior al registro del cliente.');
  }

  async function crearProgreso(idCliente, datos, actor) {
    const id = await conTransaccion(async (conexion) => {
      const cliente = await verificarAcceso(actor, idCliente, { escribir: true, conexion });
      await revisarFechaAvance(datos.fecha, cliente);
      const idProgreso = await progresoModelo.crear({ ...datos, id_cliente: idCliente, id_entrenador: actor.id_usuario }, conexion);
      await auditar(conexion, actor, MODULOS.PROGRESOS, 'registrar', `Avance ${idProgreso} registrado para el cliente ${idCliente}.`);
      return idProgreso;
    });
    return progresoPublico(await progresoModelo.buscarPorId(id), actor);
  }

  // Solo su autor y solo el mismo día en que lo registró (FR-014). Debe quedar al menos un dato.
  async function corregirProgreso(idProgreso, cambios, actor) {
    try {
      await conTransaccion(async (conexion) => {
        const avance = await progresoModelo.buscarPorId(idProgreso, conexion, { bloquear: true });
        if (!avance) throw errorNoEncontrado('El avance no existe.');
        const cliente = await verificarAcceso(actor, avance.id_cliente, { escribir: true, conexion });
        if (avance.id_entrenador !== actor.id_usuario) throw errorSinPermiso('Solo quien registró el avance puede corregirlo.');
        if (!Number(avance.del_dia)) throw errorConflicto('Un avance solo se puede corregir el mismo día en que se registró.');
        if (cambios.fecha !== undefined) await revisarFechaAvance(cambios.fecha, cliente);
        const final = { ...avance, ...cambios };
        const vacio = (v) => v === null || v === undefined || String(v).trim() === '';
        if (['peso_kg', 'grasa_pct', 'cintura_cm', 'comentario'].every((c) => vacio(final[c]))) {
          throw errorCampo('peso_kg', 'Registra al menos el peso, el porcentaje de grasa, la cintura o un comentario.');
        }
        await progresoModelo.corregir(idProgreso, cambios, conexion);
        await auditar(conexion, actor, MODULOS.PROGRESOS, 'corregir', `Avance ${idProgreso} del cliente ${avance.id_cliente} corregido.`);
      });
    } catch (error) {
      if (error.status === 409 || error.status === 403) await auditarError(actor, MODULOS.PROGRESOS, 'corregir', `Avance ${idProgreso}: corrección rechazada.`);
      throw error;
    }
    return progresoPublico(await progresoModelo.buscarPorId(idProgreso), actor);
  }

  return { verificarAcceso, obtener, obtenerRutina, crearRutina, crearObjetivo, actualizarObjetivo, crearProgreso, corregirProgreso };
}

export const { verificarAcceso, obtener, obtenerRutina, crearRutina, crearObjetivo, actualizarObjetivo, crearProgreso, corregirProgreso } =
  crearEntrenamientoService();
