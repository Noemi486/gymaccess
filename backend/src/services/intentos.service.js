import { env } from '../config/env.js';

// Bloqueo temporal por intentos fallidos de inicio de sesión (FR-003a).
// El esquema oficial no tiene dónde guardarlo, así que vive en la memoria del proceso:
// se pierde al reiniciar el servidor y no se comparte entre varias instancias.

const MAX_ENTRADAS = 10_000; // evita que el Map crezca sin límite con correos inventados

export function crearServicioIntentos({ maxIntentos, minutosBloqueo, ahora = () => Date.now() }) {
  const duracionBloqueo = minutosBloqueo * 60_000;
  // correo normalizado -> { fallos, bloqueadoHasta }
  const entradas = new Map();

  function vencida(entrada) {
    return entrada.bloqueadoHasta !== null && entrada.bloqueadoHasta <= ahora();
  }

  function limpiar() {
    for (const [correo, entrada] of entradas) {
      if (vencida(entrada)) entradas.delete(correo);
    }
    // Si aún así hay demasiadas, se descartan las más antiguas (el Map conserva el orden de alta).
    while (entradas.size >= MAX_ENTRADAS) {
      entradas.delete(entradas.keys().next().value);
    }
  }

  return {
    estaBloqueado(correo) {
      const entrada = entradas.get(correo);
      if (!entrada) return false;
      if (vencida(entrada)) {
        entradas.delete(correo); // el bloqueo terminó: el conteo empieza de cero
        return false;
      }
      return entrada.bloqueadoHasta !== null;
    },

    // Cuenta un fallo (también para correos que no existen, para no revelar si existen).
    registrarFallo(correo) {
      let entrada = entradas.get(correo);
      if (entrada && vencida(entrada)) {
        entradas.delete(correo);
        entrada = undefined;
      }
      if (!entrada) {
        if (entradas.size >= MAX_ENTRADAS) limpiar();
        entrada = { fallos: 0, bloqueadoHasta: null };
        entradas.set(correo, entrada);
      }
      entrada.fallos += 1;
      if (entrada.fallos >= maxIntentos) {
        entrada.bloqueadoHasta = ahora() + duracionBloqueo;
      }
    },

    registrarExito(correo) {
      entradas.delete(correo);
    },
  };
}

// Instancia compartida por la aplicación, con los límites de las variables de entorno.
export const intentos = crearServicioIntentos({
  maxIntentos: env.login.maxIntentos,
  minutosBloqueo: env.login.minutosBloqueo,
});
