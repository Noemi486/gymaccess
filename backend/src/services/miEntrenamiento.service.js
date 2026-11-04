import * as asignacionModeloReal from '../models/asignacion.model.js';
import * as objetivoModeloReal from '../models/objetivo.model.js';
import * as progresoModeloReal from '../models/progreso.model.js';
import * as rutinaModeloReal from '../models/rutina.model.js';
import { errorNoEncontrado, errorSinPermiso } from '../utils/errores.js';
import { conDiferencias } from '../utils/progreso.js';
import { objetivoPublico, progresoPublico, rutinaPublica } from '../utils/serializadores.js';

// "Mi entrenamiento" del cliente (spec 004, US5, FR-019). Usa SOLO el id_cliente de la sesión, no modifica nada
// y no incluye datos de contacto del entrenador (solo su nombre).
export function crearMiEntrenamientoService({
  asignacionModelo = asignacionModeloReal,
  rutinaModelo = rutinaModeloReal,
  objetivoModelo = objetivoModeloReal,
  progresoModelo = progresoModeloReal,
} = {}) {
  async function obtener(actor) {
    if (actor?.rol !== 'cliente') throw errorSinPermiso();
    if (actor.id_cliente === undefined || actor.id_cliente === null) throw errorNoEncontrado('Tu cuenta no está vinculada a un cliente.');
    const id = actor.id_cliente;
    const [asignacion, activa, objetivos, progresos] = await Promise.all([
      asignacionModelo.activaDeCliente(id),
      rutinaModelo.activaDeCliente(id),
      objetivoModelo.listarDeCliente(id),
      progresoModelo.listarDeCliente(id),
    ]);
    const rutina = activa ? rutinaPublica(activa, await rutinaModelo.ejerciciosDe(activa.id_rutina)) : null;
    if (rutina) rutina.entrenador = { nombre: rutina.entrenador.nombre };
    return {
      entrenador: asignacion ? { nombre: asignacion.entrenador_nombre, desde: asignacion.fecha_inicio } : null,
      rutina_activa: rutina,
      objetivos: objetivos.map(objetivoPublico),
      progresos: conDiferencias(progresos.map((p) => progresoPublico(p, actor))),
    };
  }
  return { obtener };
}

export const { obtener } = crearMiEntrenamientoService();
