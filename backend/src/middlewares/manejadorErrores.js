import { CODIGOS, ErrorApp, errorNoEncontrado } from '../utils/errores.js';

// Respuesta de error con una única forma: { error: { code, message, details? } }
function responder(res, status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  return res.status(status).json({ error });
}

export function manejadorNoEncontrado(_req, _res, next) {
  next(errorNoEncontrado('La ruta solicitada no existe.'));
}

// Manejador central: nunca devuelve stack ni detalles internos al usuario.
// eslint-disable-next-line no-unused-vars
export function manejadorErrores(error, _req, res, _next) {
  if (error instanceof ErrorApp) {
    return responder(res, error.status, error.code, error.message, error.details);
  }

  // Cuerpo JSON mal formado o demasiado grande (errores de express.json()).
  if (error?.type === 'entity.parse.failed') {
    return responder(res, 400, CODIGOS.VALIDATION_ERROR, 'El cuerpo de la petición no es JSON válido.');
  }
  if (error?.type === 'entity.too.large') {
    return responder(res, 413, CODIGOS.VALIDATION_ERROR, 'La petición es demasiado grande.');
  }

  // Violación de UNIQUE en MySQL (por ejemplo, correo repetido).
  if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
    return responder(res, 409, CODIGOS.CONFLICT, 'Ya existe un registro con esos datos.');
  }

  // Cualquier otro fallo: se registra en el servidor y el usuario ve un mensaje genérico.
  console.error('Error no controlado:', error?.code ?? '', error?.message ?? error);
  return responder(res, 500, CODIGOS.INTERNAL_ERROR, 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.');
}
