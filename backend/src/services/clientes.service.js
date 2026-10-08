import { conTransaccion as conTransaccionReal } from '../config/db.js';
import * as clienteModel from '../models/cliente.model.js';
import * as usuarioModel from '../models/usuario.model.js';
import { normalizarCorreo } from '../utils/correo.js';
import {
  errorConflicto,
  errorNoEncontrado,
  errorSinPermiso,
  errorValidacion,
} from '../utils/errores.js';
import { clientePublico } from '../utils/serializadores.js';
import { vistaCliente } from '../utils/vistaCliente.js';

const ROLES_ESCRITURA = ['administrador', 'recepcionista'];
const ROLES_CONSULTA = ['administrador', 'recepcionista', 'entrenador'];
const CAMPOS_OBLIGATORIOS = ['nombre', 'apellido', 'telefono'];

const conflictoCorreo = () =>
  errorConflicto('Ya existe un cliente con ese correo.', [
    { field: 'correo', message: 'Ese correo ya está registrado en otro cliente.' },
  ]);

const conflictoCuenta = () =>
  errorConflicto('No se puede cambiar ni quitar el correo de un cliente que ya tiene cuenta de acceso.', [
    { field: 'correo', message: 'Este cliente tiene cuenta de acceso: su correo no se puede cambiar ni quitar.' },
  ]);

function exigirRol(actor, ...roles) {
  if (!actor || !roles.includes(actor.rol)) throw errorSinPermiso();
}

// Un duplicado que se cuela entre la comprobación y el INSERT lo detecta el índice UNIQUE de MySQL.
function traducirDuplicado(error) {
  return error?.code === 'ER_DUP_ENTRY' ? conflictoCorreo() : error;
}

// Texto recortado; null si queda vacío (correo y dirección opcionales).
const textoOpcional = (valor) => {
  if (valor === undefined) return undefined;
  const limpio = valor === null ? '' : String(valor).trim();
  return limpio === '' ? null : limpio;
};

// Las dependencias se inyectan para poder probar el servicio sin base de datos.
export function crearClientesService({ modelo, usuariosModelo, conTransaccion }) {
  // Defensa en profundidad (el validador ya lo exige): nombre, apellido y teléfono no pueden quedar vacíos.
  function exigirObligatorios(datos, { todos }) {
    const detalles = [];
    for (const campo of CAMPOS_OBLIGATORIOS) {
      const presente = datos[campo] !== undefined;
      if (!presente && !todos) continue;
      if (typeof datos[campo] !== 'string' || datos[campo].trim() === '') {
        detalles.push({ field: campo, message: 'Este campo es obligatorio.' });
      }
    }
    if (detalles.length > 0) throw errorValidacion('Revisa los datos enviados.', detalles);
  }

  async function crear(datos, actor) {
    exigirRol(actor, ...ROLES_ESCRITURA);
    exigirObligatorios(datos, { todos: true });

    const correo = normalizarCorreo(datos.correo);
    if (correo && (await modelo.buscarPorCorreo(correo))) throw conflictoCorreo();

    try {
      const id = await modelo.crear({
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        telefono: datos.telefono.trim(),
        correo,
        direccion: textoOpcional(datos.direccion) ?? null,
      });
      return clientePublico(await modelo.buscarPorId(id));
    } catch (error) {
      throw traducirDuplicado(error);
    }
  }

  async function actualizar(id, cambios, actor) {
    exigirRol(actor, ...ROLES_ESCRITURA);
    exigirObligatorios(cambios, { todos: false });

    try {
      return await conTransaccion(async (conexion) => {
        const actual = await modelo.buscarPorId(id, conexion, { bloquear: true });
        if (!actual) throw errorNoEncontrado('El cliente no existe.');

        const correoNuevo = cambios.correo === undefined ? undefined : normalizarCorreo(cambios.correo);
        if (correoNuevo !== undefined && correoNuevo !== actual.correo) {
          // Si el cliente tiene cuenta, la cuenta usa su correo: no se puede cambiar ni quitar.
          if (await usuariosModelo.buscarPorIdCliente(id, conexion)) throw conflictoCuenta();
          if (correoNuevo !== null) {
            const otro = await modelo.buscarPorCorreo(correoNuevo, conexion);
            if (otro && otro.id_cliente !== actual.id_cliente) throw conflictoCorreo();
          }
        }

        await modelo.actualizar(
          id,
          {
            nombre: cambios.nombre?.trim(),
            apellido: cambios.apellido?.trim(),
            telefono: cambios.telefono?.trim(),
            correo: correoNuevo,
            direccion: textoOpcional(cambios.direccion),
          },
          conexion,
        );
        return clientePublico(await modelo.buscarPorId(id, conexion));
      });
    } catch (error) {
      throw traducirDuplicado(error);
    }
  }

  // Baja o reactivación lógica: solo el administrador (FR-021).
  async function cambiarEstado(id, estado, actor) {
    exigirRol(actor, 'administrador');
    const actual = await modelo.buscarPorId(id);
    if (!actual) throw errorNoEncontrado('El cliente no existe.');
    await modelo.cambiarEstado(id, estado);
    return clientePublico(await modelo.buscarPorId(id));
  }

  // Consulta del personal (FR-019): cada rol recibe solo los campos que le corresponden.
  async function listar({ q, estado, page, limit, offset, paraCuenta = false }, actor) {
    exigirRol(actor, ...ROLES_CONSULTA);
    // "Disponibles para crear una cuenta" revela quién tiene cuenta y correo: solo el administrador.
    if (paraCuenta) exigirRol(actor, 'administrador');
    const { filas, total } = await modelo.listar({
      q,
      estado,
      limit,
      offset,
      // El entrenador no ve el correo: tampoco puede buscar por él.
      buscarEnCorreo: actor.rol !== 'entrenador',
      paraCuenta,
    });
    return { data: filas.map((fila) => vistaCliente(fila, actor.rol)), page, limit, total };
  }

  async function obtener(id, actor) {
    exigirRol(actor, ...ROLES_CONSULTA);
    const cliente = await modelo.buscarPorId(id);
    if (!cliente) throw errorNoEncontrado('El cliente no existe.');
    return vistaCliente(cliente, actor.rol);
  }

  // Información propia del cliente (FR-020). Usa SIEMPRE el id_cliente de la sesión, nunca un id
  // recibido en la petición: así un cliente no puede consultar a otro.
  async function obtenerPropio(actor) {
    exigirRol(actor, 'cliente');
    if (actor.id_cliente === undefined || actor.id_cliente === null) {
      throw errorNoEncontrado('Tu cuenta no está vinculada a un cliente.');
    }
    const cliente = await modelo.buscarPorId(actor.id_cliente);
    if (!cliente) throw errorNoEncontrado('No se encontró tu información de cliente.');
    return clientePublico(cliente);
  }

  return { listar, obtener, obtenerPropio, crear, actualizar, cambiarEstado };
}

const servicio = crearClientesService({
  modelo: clienteModel,
  usuariosModelo: usuarioModel,
  conTransaccion: conTransaccionReal,
});

export const { listar, obtener, obtenerPropio, crear, actualizar, cambiarEstado } = servicio;
