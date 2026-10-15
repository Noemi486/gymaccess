import { conTransaccion as conTransaccionReal } from '../config/db.js';
import { env } from '../config/env.js';
import * as clienteModeloReal from '../models/cliente.model.js';
import * as rostroModeloReal from '../models/rostro.model.js';
import * as auditoriaServicio from './auditoria.service.js';
import { MODULOS } from './auditoria.service.js';
import { cifrarDescriptor, descifrarDescriptor } from '../utils/cifradoFacial.js';
import { buscarCoincidencia } from '../utils/distanciaFacial.js';
import { errorConflicto, errorNoEncontrado } from '../utils/errores.js';
import { rostroPublico } from '../utils/serializadores.js';

// Módulo de reconocimiento: guarda, consulta y compara descriptores faciales. Es independiente del de
// control de acceso (que solo le pide `encontrarCoincidencia`). Nunca registra ni devuelve el descriptor.
export function crearRostrosService({
  modelo = rostroModeloReal,
  clienteModelo = clienteModeloReal,
  auditoria = auditoriaServicio,
  conTransaccion = conTransaccionReal,
  clave = env.faceKey,
} = {}) {
  async function auditar(conexion, actor, accion, descripcion) {
    await auditoria.registrarExito(conexion, { id_usuario: actor.id_usuario, accion, modulo: MODULOS.ROSTROS, descripcion });
  }

  // GET /clientes/:id/rostro
  async function consultar(idCliente) {
    if (!(await clienteModelo.buscarPorId(idCliente))) throw errorNoEncontrado('El cliente no existe.');
    const filas = await modelo.listarPorCliente(idCliente);
    const activo = filas.find((fila) => fila.estado === 'activo') ?? null;
    return {
      registrado: activo !== null,
      activo: activo ? { id_rostro: activo.id_rostro, fecha_registro: activo.fecha_registro } : null,
      historial: filas.map(rostroPublico),
    };
  }

  // POST /clientes/:id/rostro: el registro nuevo deja inactivo al anterior (a lo más un rostro activo).
  async function registrar(idCliente, { descriptor }, actor) {
    return conTransaccion(async (conexion) => {
      const cliente = await clienteModelo.buscarPorId(idCliente, conexion, { bloquear: true });
      if (!cliente) throw errorNoEncontrado('El cliente no existe.');
      if (cliente.estado !== 'activo') throw errorConflicto('El cliente está dado de baja: no se le puede registrar el rostro.');

      const reemplazados = await modelo.desactivarActivosDeCliente(idCliente, conexion);
      const id = await modelo.insertar({ id_cliente: idCliente, descriptor_facial: cifrarDescriptor(descriptor, idCliente, clave) }, conexion);
      await auditar(
        conexion,
        actor,
        reemplazados > 0 ? 'reemplazar' : 'registrar',
        `Rostro ${id} ${reemplazados > 0 ? 'reemplazado' : 'registrado'} para el cliente ${idCliente}.`,
      );
      return rostroPublico(await modelo.buscarPorId(id, conexion));
    });
  }

  // PATCH /rostros/:id/estado (solo administrador). Reactivar deja inactivo el que estuviera activo.
  async function cambiarEstado(idRostro, estado, actor) {
    return conTransaccion(async (conexion) => {
      // Lectura fuera de la transacción: no fija la instantánea antes del bloqueo del cliente.
      const previa = await modelo.buscarPorId(idRostro);
      if (!previa) throw errorNoEncontrado('El rostro no existe.');
      const cliente = await clienteModelo.buscarPorId(previa.id_cliente, conexion, { bloquear: true });
      const fila = await modelo.buscarPorId(idRostro, conexion, { bloquear: true });

      if (fila.estado !== estado) {
        if (estado === 'activo') {
          if (cliente.estado !== 'activo') throw errorConflicto('El cliente está dado de baja: no se puede reactivar su rostro.');
          await modelo.desactivarActivosDeCliente(fila.id_cliente, conexion);
        }
        await modelo.cambiarEstado(idRostro, estado, conexion);
        await auditar(
          conexion,
          actor,
          estado === 'activo' ? 'reactivar' : 'desactivar',
          `Rostro ${idRostro} del cliente ${fila.id_cliente} ${estado === 'activo' ? 'reactivado' : 'desactivado'}.`,
        );
      }
      const actualizado = await modelo.buscarPorId(idRostro, conexion);
      return { ...rostroPublico(actualizado), id_cliente: actualizado.id_cliente };
    });
  }

  // Compara el descriptor recibido con los rostros activos. Devuelve { tipo: 'clara' | 'ninguna' | 'ambigua', id_cliente? }.
  // Un rostro que no se pueda descifrar se omite (y se avisa sin datos); nunca interrumpe la identificación.
  async function encontrarCoincidencia(descriptor) {
    const filas = await modelo.listarActivosConCliente();
    const candidatos = [];
    for (const fila of filas) {
      try {
        candidatos.push({ id_cliente: fila.id_cliente, descriptor: descifrarDescriptor(fila.descriptor_facial, fila.id_cliente, clave) });
      } catch {
        console.error(`Rostro ${fila.id_rostro} omitido: no se pudo descifrar.`);
      }
    }
    const resultado = buscarCoincidencia(descriptor, candidatos);
    return resultado.tipo === 'clara' ? { tipo: 'clara', id_cliente: resultado.id_cliente } : { tipo: resultado.tipo };
  }

  return { consultar, registrar, cambiarEstado, encontrarCoincidencia };
}

export const { consultar, registrar, cambiarEstado, encontrarCoincidencia } = crearRostrosService();
