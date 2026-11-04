import { conTransaccion as conTransaccionReal } from '../config/db.js';
import * as entrenadorModeloReal from '../models/entrenador.model.js';
import * as usuarioModeloReal from '../models/usuario.model.js';
import * as auditoriaReal from './auditoria.service.js';
import { MODULOS } from './auditoria.service.js';
import { hashearContrasena } from '../utils/contrasena.js';
import { errorConflicto, errorNoEncontrado } from '../utils/errores.js';
import { entrenadorPublico } from '../utils/serializadores.js';

const conflictoCorreo = () =>
  errorConflicto('Ya existe un usuario con ese correo.', [{ field: 'correo', message: 'Ese correo ya está en uso.' }]);

export const mensajeConClientes = (n) =>
  `Reasigna primero ${n === 1 ? 'a su cliente' : `a sus ${n} clientes`}: un entrenador con clientes asignados no puede desactivarse.`;

// Entrenadores (spec 004, US1, FR-001 a FR-004). Dependencias inyectables para probar sin base de datos.
export function crearEntrenadoresService({
  modelo = entrenadorModeloReal,
  usuarioModelo = usuarioModeloReal,
  auditoria = auditoriaReal,
  conTransaccion = conTransaccionReal,
  hashear = hashearContrasena,
} = {}) {
  const auditar = (conexion, actor, accion, descripcion) =>
    auditoria.registrarExito(conexion, { id_usuario: actor.id_usuario, accion, modulo: MODULOS.ENTRENADORES, descripcion });
  const auditarError = (actor, accion, descripcion) =>
    auditoria.registrarError({ id_usuario: actor.id_usuario, accion, modulo: MODULOS.ENTRENADORES, descripcion });

  async function listar({ q, estado, page, limit, offset }) {
    const { filas, total } = await modelo.listar({ q, estado, limit, offset });
    return { data: filas.map(entrenadorPublico), page, limit, total };
  }

  async function obtener(idUsuario) {
    const fila = await modelo.buscarPorId(idUsuario);
    if (!fila) throw errorNoEncontrado('El entrenador no existe.');
    const clientes = await modelo.clientesAsignados(idUsuario);
    return { ...entrenadorPublico(fila), clientes };
  }

  // Cuenta (rol entrenador) + ficha en una sola transacción: o ambas o ninguna (FR-001).
  async function crear({ nombre, correo, password, telefono = null, especialidad = null }, actor) {
    if (await usuarioModelo.buscarPorCorreo(correo)) throw conflictoCorreo();
    const hash = await hashear(password);
    try {
      const id = await conTransaccion(async (conexion) => {
        const idUsuario = await usuarioModelo.crear({ nombre, correo, password: hash, rol: 'entrenador' }, conexion);
        await modelo.crearFicha({ id_usuario: idUsuario, telefono, especialidad }, conexion);
        await auditar(conexion, actor, 'crear', `Entrenador ${idUsuario} registrado.`);
        return idUsuario;
      });
      return obtener(id);
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw conflictoCorreo();
      throw error;
    }
  }

  async function actualizar(idUsuario, { nombre, telefono, especialidad }, actor) {
    await conTransaccion(async (conexion) => {
      const actual = await modelo.buscarPorId(idUsuario, conexion, { bloquear: true });
      if (!actual) throw errorNoEncontrado('El entrenador no existe.');
      if (nombre !== undefined) await usuarioModelo.actualizar(idUsuario, { nombre }, conexion);
      if (telefono !== undefined || especialidad !== undefined) await modelo.guardarFicha(idUsuario, { telefono, especialidad }, conexion);
      await auditar(conexion, actor, 'modificar', `Entrenador ${idUsuario} modificado.`);
    });
    return obtener(idUsuario);
  }

  // Baja lógica: el estado es el de la cuenta. Con asignaciones activas no se desactiva (FR-002).
  async function cambiarEstado(idUsuario, estado, actor) {
    const accion = estado === 'inactivo' ? 'desactivar' : 'activar';
    try {
      await conTransaccion(async (conexion) => {
        const actual = await modelo.buscarPorId(idUsuario, conexion, { bloquear: true });
        if (!actual) throw errorNoEncontrado('El entrenador no existe.');
        if (estado === 'inactivo') {
          const n = await modelo.contarAsignacionesActivas(idUsuario, conexion);
          if (n > 0) throw errorConflicto(mensajeConClientes(n));
        }
        if (actual.estado !== estado) await usuarioModelo.actualizar(idUsuario, { estado }, conexion);
        await auditar(conexion, actor, accion, `Entrenador ${idUsuario} ${estado === 'inactivo' ? 'desactivado' : 'activado'}.`);
      });
    } catch (error) {
      if (error.status === 409) await auditarError(actor, accion, `Desactivación rechazada para el entrenador ${idUsuario}.`);
      throw error;
    }
    return obtener(idUsuario);
  }

  return { listar, obtener, crear, actualizar, cambiarEstado };
}

export const { listar, obtener, crear, actualizar, cambiarEstado } = crearEntrenadoresService();
