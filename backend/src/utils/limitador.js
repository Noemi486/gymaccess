import { errorDemasiadasPeticiones, errorNoAutenticado } from './errores.js';

// Limitador de peticiones por clave, en memoria del proceso (ventana deslizante).
// Se usa para frenar el abuso de la identificación facial: máximo `maximo` peticiones por `ventanaMs`.
export function crearLimitador({ maximo, ventanaMs, ahora = () => Date.now() }) {
  const registros = new Map(); // clave -> marcas de tiempo (ms) dentro de la ventana

  function limpiar(marcas, instante) {
    while (marcas.length > 0 && instante - marcas[0] >= ventanaMs) marcas.shift();
  }

  return {
    intentar(clave) {
      const instante = ahora();
      const marcas = registros.get(clave) ?? [];
      limpiar(marcas, instante);

      if (marcas.length >= maximo) {
        registros.set(clave, marcas);
        return { permitido: false, reintentarEnMs: ventanaMs - (instante - marcas[0]) };
      }
      marcas.push(instante);
      registros.set(clave, marcas);

      // Evita que el mapa crezca sin límite con claves que ya no se usan.
      if (registros.size > 10_000) {
        for (const [otra, lista] of registros) {
          limpiar(lista, instante);
          if (lista.length === 0) registros.delete(otra);
        }
      }
      return { permitido: true, reintentarEnMs: 0 };
    },
  };
}

// Middleware: limita por usuario autenticado (va siempre después de `autenticar`).
export function limitarPorUsuario(limitador) {
  return (req, _res, next) => {
    if (!req.usuario) return next(errorNoAutenticado());
    const { permitido } = limitador.intentar(`usuario:${req.usuario.id_usuario}`);
    if (!permitido) return next(errorDemasiadasPeticiones());
    return next();
  };
}
