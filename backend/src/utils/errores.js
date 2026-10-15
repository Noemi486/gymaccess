// Errores de la aplicación: llevan un estado HTTP, un código estable y un mensaje
// pensado para el usuario (sin información interna del servidor).

export const CODIGOS = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

export class ErrorApp extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ErrorApp';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errorValidacion = (message = 'Revisa los datos enviados.', details) =>
  new ErrorApp(400, CODIGOS.VALIDATION_ERROR, message, details);

export const errorNoAutenticado = (message = 'Debes iniciar sesión para continuar.') =>
  new ErrorApp(401, CODIGOS.UNAUTHORIZED, message);

export const errorSinPermiso = (message = 'No tienes permiso para realizar esta acción.') =>
  new ErrorApp(403, CODIGOS.FORBIDDEN, message);

export const errorNoEncontrado = (message = 'El recurso solicitado no existe.') =>
  new ErrorApp(404, CODIGOS.NOT_FOUND, message);

export const errorConflicto = (message, details) =>
  new ErrorApp(409, CODIGOS.CONFLICT, message, details);

export const errorBloqueado = (message = 'Cuenta bloqueada temporalmente. Inténtalo más tarde.') =>
  new ErrorApp(423, CODIGOS.ACCOUNT_LOCKED, message);

export const errorDemasiadasPeticiones = (message = 'Demasiados intentos. Espera un momento.') =>
  new ErrorApp(429, CODIGOS.TOO_MANY_REQUESTS, message);
