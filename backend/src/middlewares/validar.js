import { errorValidacion } from '../utils/errores.js';
import '../validators/mensajes.js'; // mensajes de zod en español

// Valida `body`, `query` o `params` con un esquema zod.
// El resultado ya limpio queda en `req.validado[origen]` (en Express 5 `req.query`
// es de solo lectura, por eso no se reemplaza el original).
export function validar(esquema, origen = 'body') {
  return (req, _res, next) => {
    const resultado = esquema.safeParse(req[origen] ?? {});
    if (!resultado.success) {
      const detalles = resultado.error.issues.map((problema) => ({
        field: problema.path.join('.') || origen,
        message: problema.message,
      }));
      return next(errorValidacion('Revisa los datos enviados.', detalles));
    }
    req.validado = { ...req.validado, [origen]: resultado.data };
    return next();
  };
}
