import { conTransaccion as conTransaccionReal } from '../config/db.js';
import * as usuarioModel from '../models/usuario.model.js';
import * as clienteModel from '../models/cliente.model.js';
import {
  MENSAJE_POLITICA,
  hashearContrasena,
  validarPoliticaContrasena,
} from '../utils/contrasena.js';
import {
  errorConflicto,
  errorNoEncontrado,
  errorValidacion,
} from '../utils/errores.js';
import { usuarioPublico } from '../utils/serializadores.js';

const conflictoCorreo = () =>
  errorConflicto('Ya existe un usuario con ese correo.', [
    { field: 'correo', message: 'Ese correo ya está en uso.' },
  ]);

const errorPassword = () =>
  errorValidacion('Revisa los datos enviados.', [{ field: 'password', message: MENSAJE_POLITICA }]);

// Un duplicado que se cuela entre la comprobación y el INSERT lo detecta el índice UNIQUE de MySQL.
function traducirDuplicado(error) {
  if (error?.code !== 'ER_DUP_ENTRY') return error;
  if (String(error.message).includes('uq_usuarios_cliente')) {
    return errorConflicto('Ese cliente ya tiene una cuenta.');
  }
  return conflictoCorreo();
}

// Las dependencias se inyectan para poder probar el servicio sin base de datos.
export function crearUsuariosService({ modelo, clientesModelo, conTransaccion, hashear }) {
  async function listar({ rol, estado, page, limit, offset }) {
    const { filas, total } = await modelo.listar({ rol, estado, limit, offset });
    return { data: filas.map(usuarioPublico), page, limit, total };
  }

  async function obtener(id) {
    const usuario = await modelo.buscarPorId(id);
    if (!usuario) throw errorNoEncontrado('El usuario no existe.');
    return usuarioPublico(usuario);
  }

  // Reglas de una cuenta con rol cliente (FR-011): el cliente existe, tiene correo,
  // la cuenta usa ese mismo correo y el cliente no tiene ya otra cuenta.
  async function validarCuentaDeCliente({ id_cliente, correo }) {
    const cliente = await clientesModelo.buscarPorId(id_cliente);
    if (!cliente) throw errorNoEncontrado('El cliente indicado no existe.');
    if (!cliente.correo) {
      throw errorConflicto('El cliente no tiene correo: captúralo antes de crear su cuenta.', [
        { field: 'id_cliente', message: 'Este cliente no tiene correo registrado.' },
      ]);
    }
    if (cliente.correo !== correo) {
      throw errorConflicto('El correo de la cuenta debe ser el mismo del cliente.', [
        { field: 'correo', message: 'Debe ser el correo registrado del cliente.' },
      ]);
    }
    if (await modelo.buscarPorIdCliente(id_cliente)) {
      throw errorConflicto('Ese cliente ya tiene una cuenta.', [
        { field: 'id_cliente', message: 'Este cliente ya tiene una cuenta.' },
      ]);
    }
  }

  async function crear({ nombre, correo, password, rol, id_cliente }) {
    if (validarPoliticaContrasena(password) !== null) throw errorPassword();

    if (rol === 'cliente') {
      if (id_cliente === undefined || id_cliente === null) {
        throw errorValidacion('Revisa los datos enviados.', [
          { field: 'id_cliente', message: 'El ID del cliente es obligatorio para el rol cliente.' },
        ]);
      }
      await validarCuentaDeCliente({ id_cliente, correo });
    } else if (id_cliente !== undefined && id_cliente !== null) {
      throw errorValidacion('Revisa los datos enviados.', [
        { field: 'id_cliente', message: 'Solo las cuentas con rol cliente llevan ID de cliente.' },
      ]);
    }

    if (await modelo.buscarPorCorreo(correo)) throw conflictoCorreo();

    const hash = await hashear(password);
    try {
      const id = await modelo.crear({
        nombre,
        correo,
        password: hash,
        rol,
        id_cliente: rol === 'cliente' ? id_cliente : null,
      });
      return usuarioPublico(await modelo.buscarPorId(id));
    } catch (error) {
      throw traducirDuplicado(error);
    }
  }

  async function actualizar(id, cambios) {
    if (cambios.password !== undefined && validarPoliticaContrasena(cambios.password) !== null) {
      throw errorPassword();
    }
    // El hash se calcula antes de abrir la transacción para no mantener bloqueos mientras tanto.
    const hash = cambios.password !== undefined ? await hashear(cambios.password) : undefined;

    try {
      return await conTransaccion(async (conexion) => {
        const actual = await modelo.buscarPorId(id, conexion, { bloquear: true });
        if (!actual) throw errorNoEncontrado('El usuario no existe.');

        const cambiaRol = cambios.rol !== undefined && cambios.rol !== actual.rol;
        if (cambiaRol && (cambios.rol === 'cliente' || actual.rol === 'cliente')) {
          throw errorConflicto('No se puede cambiar un usuario hacia o desde el rol cliente.', [
            { field: 'rol', message: 'El rol cliente se fija al crear la cuenta.' },
          ]);
        }

        if (cambios.correo !== undefined && cambios.correo !== actual.correo) {
          if (actual.rol === 'cliente') {
            throw errorConflicto('El correo de una cuenta de cliente es el del cliente y no se puede cambiar aquí.', [
              { field: 'correo', message: 'El correo de esta cuenta es el del cliente.' },
            ]);
          }
          const otro = await modelo.buscarPorCorreo(cambios.correo, conexion);
          if (otro && otro.id_usuario !== actual.id_usuario) throw conflictoCorreo();
        }

        // Un administrador activo deja de serlo al desactivarse o al cambiar de rol:
        // el sistema nunca debe quedarse sin administradores activos (FR-012).
        const dejaDeSerAdministradorActivo =
          actual.rol === 'administrador' &&
          actual.estado === 'activo' &&
          ((cambiaRol && cambios.rol !== 'administrador') || cambios.estado === 'inactivo');
        if (dejaDeSerAdministradorActivo) {
          const activos = await modelo.contarAdministradoresActivos(conexion);
          if (activos <= 1) {
            throw errorConflicto('No puedes dejar al sistema sin administradores activos.');
          }
        }

        await modelo.actualizar(
          id,
          {
            nombre: cambios.nombre,
            correo: cambios.correo,
            rol: cambios.rol,
            estado: cambios.estado,
            password: hash,
          },
          conexion,
        );
        return usuarioPublico(await modelo.buscarPorId(id, conexion));
      });
    } catch (error) {
      throw traducirDuplicado(error);
    }
  }

  return { listar, obtener, crear, actualizar };
}

const servicio = crearUsuariosService({
  modelo: usuarioModel,
  clientesModelo: clienteModel,
  conTransaccion: conTransaccionReal,
  hashear: hashearContrasena,
});

export const { listar, obtener, crear, actualizar } = servicio;
