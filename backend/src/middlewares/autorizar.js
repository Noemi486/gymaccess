import { errorNoAutenticado, errorSinPermiso } from '../utils/errores.js';

// Permite el paso solo a los roles indicados. Va siempre después de `autenticar`.
export function autorizar(...rolesPermitidos) {
  return (req, _res, next) => {
    if (!req.usuario) return next(errorNoAutenticado());
    if (!rolesPermitidos.includes(req.usuario.rol)) return next(errorSinPermiso());
    return next();
  };
}
