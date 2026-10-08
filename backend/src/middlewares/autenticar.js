import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { buscarPorId as buscarUsuarioPorId } from '../models/usuario.model.js';
import { errorNoAutenticado } from '../utils/errores.js';

const MENSAJE_SESION = 'La sesión no es válida o ya venció.';

// Exige una sesión válida. Después de verificar el JWT vuelve a leer el usuario en la
// base de datos: así desactivar una cuenta o cambiar su rol surte efecto de inmediato
// y los permisos nunca se confían a lo que diga el token.
// Las dependencias se inyectan para poder probarlo sin base de datos.
export function crearAutenticar({ secreto, buscarPorId }) {
  return async function autenticar(req, _res, next) {
    const cabecera = req.headers.authorization ?? '';
    const [esquema, token] = cabecera.split(' ');
    if (esquema !== 'Bearer' || !token) {
      return next(errorNoAutenticado());
    }

    let payload;
    try {
      payload = jwt.verify(token, secreto, { algorithms: ['HS256'] });
    } catch {
      return next(errorNoAutenticado(MENSAJE_SESION));
    }

    const idUsuario = Number(payload.sub);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      return next(errorNoAutenticado(MENSAJE_SESION));
    }

    const usuario = await buscarPorId(idUsuario);
    // La sesión también deja de valer si la cuenta es de un cliente dado de baja (FR-003b).
    if (!usuario || usuario.estado !== 'activo' || usuario.estado_cliente === 'inactivo') {
      return next(errorNoAutenticado(MENSAJE_SESION));
    }

    // Se copian solo los campos públicos: el hash de la contraseña nunca llega a req.
    req.usuario = {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: usuario.estado,
      id_cliente: usuario.id_cliente,
      fecha_registro: usuario.fecha_registro,
    };
    return next();
  };
}

export const autenticar = crearAutenticar({
  secreto: env.jwt.secreto,
  buscarPorId: buscarUsuarioPorId,
});
