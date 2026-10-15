import { conTransaccion as conTransaccionReal } from '../config/db.js';
import * as tipoModel from '../models/tipoMembresia.model.js';
import * as auditoriaServicio from './auditoria.service.js';
import { MODULOS } from './auditoria.service.js';
import { errorConflicto, errorNoEncontrado } from '../utils/errores.js';
import { tipoMembresiaPublico } from '../utils/serializadores.js';

const conflictoNombre = () =>
  errorConflicto('Ya existe un plan con ese nombre.', [{ field: 'nombre', message: 'Ese nombre ya está en uso.' }]);

// Un duplicado que se cuela entre la comprobación y el INSERT lo detecta el índice UNIQUE de MySQL.
const traducirDuplicado = (error) => (error?.code === 'ER_DUP_ENTRY' ? conflictoNombre() : error);

// Las dependencias se inyectan para poder probar el servicio sin base de datos.
export function crearTiposMembresiaService({ modelo, auditoria, conTransaccion }) {
  // El recepcionista solo trabaja con planes activos (los que puede asignar).
  const soloActivos = (actor) => actor.rol === 'recepcionista';

  async function listar({ q, estado, page, limit, offset }, actor) {
    const estadoEfectivo = soloActivos(actor) ? 'activo' : estado;
    const { filas, total } = await modelo.listar({ q, estado: estadoEfectivo, limit, offset });
    return { data: filas.map(tipoMembresiaPublico), page, limit, total };
  }

  async function obtener(id, actor) {
    const fila = await modelo.buscarPorId(id);
    if (!fila || (soloActivos(actor) && fila.estado !== 'activo')) {
      throw errorNoEncontrado('El plan de membresía no existe.');
    }
    return {
      ...tipoMembresiaPublico(fila),
      membresias_pendientes_de_pago: Number(fila.membresias_pendientes_de_pago),
    };
  }

  async function registrarFallo(actor, accion, descripcion) {
    await auditoria.registrarError({ id_usuario: actor.id_usuario, accion, modulo: MODULOS.TIPOS_MEMBRESIA, descripcion });
  }

  async function crear(datos, actor) {
    try {
      return await conTransaccion(async (conexion) => {
        if (await modelo.buscarPorNombre(datos.nombre, conexion)) throw conflictoNombre();
        const id = await modelo.crear(datos, conexion);
        await auditoria.registrarExito(conexion, {
          id_usuario: actor.id_usuario,
          accion: 'crear',
          modulo: MODULOS.TIPOS_MEMBRESIA,
          descripcion: `Plan de membresía ${id} creado.`,
        });
        return tipoMembresiaPublico(await modelo.buscarPorId(id, conexion));
      });
    } catch (error) {
      const traducido = traducirDuplicado(error);
      if (traducido.status === 409) await registrarFallo(actor, 'crear', 'Nombre de plan repetido.');
      throw traducido;
    }
  }

  async function actualizar(id, cambios, actor) {
    try {
      return await conTransaccion(async (conexion) => {
        const actual = await modelo.buscarPorId(id, conexion, { bloquear: true });
        if (!actual) throw errorNoEncontrado('El plan de membresía no existe.');

        if (cambios.nombre !== undefined) {
          const otro = await modelo.buscarPorNombre(cambios.nombre, conexion);
          if (otro && otro.id_tipo_membresia !== actual.id_tipo_membresia) throw conflictoNombre();
        }

        await modelo.actualizar(id, cambios, conexion);
        await auditoria.registrarExito(conexion, {
          id_usuario: actor.id_usuario,
          accion: 'modificar',
          modulo: MODULOS.TIPOS_MEMBRESIA,
          descripcion: `Plan de membresía ${id} modificado (campos: ${Object.keys(cambios).join(', ')}).`,
        });
        return tipoMembresiaPublico(await modelo.buscarPorId(id, conexion));
      });
    } catch (error) {
      const traducido = traducirDuplicado(error);
      if (traducido.status === 409) await registrarFallo(actor, 'modificar', `Nombre repetido al modificar el plan ${id}.`);
      throw traducido;
    }
  }

  async function cambiarEstado(id, estado, actor) {
    return conTransaccion(async (conexion) => {
      const actual = await modelo.buscarPorId(id, conexion, { bloquear: true });
      if (!actual) throw errorNoEncontrado('El plan de membresía no existe.');

      if (actual.estado !== estado) {
        await modelo.cambiarEstado(id, estado, conexion);
        await auditoria.registrarExito(conexion, {
          id_usuario: actor.id_usuario,
          accion: estado === 'inactivo' ? 'desactivar' : 'activar',
          modulo: MODULOS.TIPOS_MEMBRESIA,
          descripcion: `Plan de membresía ${id} ${estado === 'inactivo' ? 'desactivado' : 'activado'}.`,
        });
      }
      return tipoMembresiaPublico(await modelo.buscarPorId(id, conexion));
    });
  }

  return { listar, obtener, crear, actualizar, cambiarEstado };
}

const servicio = crearTiposMembresiaService({
  modelo: tipoModel,
  auditoria: auditoriaServicio,
  conTransaccion: conTransaccionReal,
});

export const { listar, obtener, crear, actualizar, cambiarEstado } = servicio;
