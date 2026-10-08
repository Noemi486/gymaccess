import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as usuarioModel from '../models/usuario.model.js';
import { intentos as intentosCompartidos } from './intentos.service.js';
import { compararContrasena, hashearContrasena, COSTO_BCRYPT } from '../utils/contrasena.js';
import { errorBloqueado, errorNoAutenticado } from '../utils/errores.js';
import { usuarioPublico } from '../utils/serializadores.js';

// Mismo mensaje para correo inexistente, contraseña errónea y cuenta inactiva (FR-002):
// así no se revela si el correo existe.
const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';
const MENSAJE_BLOQUEO =
  'Cuenta bloqueada temporalmente por demasiados intentos fallidos. Inténtalo de nuevo más tarde.';

// Las dependencias se inyectan para poder probar el servicio sin base de datos.
export function crearAuthService({ modelo, intentos, config }) {
  const costo = config.costoBcrypt ?? COSTO_BCRYPT;
  // Hash de relleno: cuando el correo no existe también se hace una comparación bcrypt,
  // para que la respuesta tarde parecido y no delate si la cuenta existe.
  let hashFicticio;
  const obtenerHashFicticio = async () => {
    hashFicticio ??= await hashearContrasena('contrasena-ficticia-sin-uso', costo);
    return hashFicticio;
  };

  async function iniciarSesion(correo, password) {
    if (intentos.estaBloqueado(correo)) {
      throw errorBloqueado(MENSAJE_BLOQUEO);
    }

    const usuario = await modelo.buscarPorCorreo(correo);
    const coincide = await compararContrasena(password, usuario?.password ?? (await obtenerHashFicticio()));

    // Cuenta inexistente, contraseña errónea, cuenta desactivada o cliente dado de baja (FR-003b):
    // en todos los casos el mismo error genérico, para no revelar cuál fue el motivo.
    if (!usuario || !coincide || usuario.estado !== 'activo' || usuario.estado_cliente === 'inactivo') {
      intentos.registrarFallo(correo);
      throw errorNoAutenticado(MENSAJE_CREDENCIALES);
    }

    intentos.registrarExito(correo);
    const token = jwt.sign({ sub: String(usuario.id_usuario) }, config.jwtSecreto, {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiracion,
    });
    return { token, usuario: usuarioPublico(usuario) };
  }

  // La sesión actual: req.usuario ya viene de la base de datos (lo carga `autenticar`).
  function obtenerSesion(usuario) {
    return usuarioPublico(usuario);
  }

  return { iniciarSesion, obtenerSesion };
}

const servicio = crearAuthService({
  modelo: usuarioModel,
  intentos: intentosCompartidos,
  config: { jwtSecreto: env.jwt.secreto, jwtExpiracion: env.jwt.expiracion },
});

export const { iniciarSesion, obtenerSesion } = servicio;
