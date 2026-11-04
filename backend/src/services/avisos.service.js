import * as avisoModeloReal from '../models/aviso.model.js';
import { errorNoEncontrado, errorSinPermiso } from '../utils/errores.js';

const PERSONAL = ['administrador', 'recepcionista'];

// Avisos de la campana (US12, FR-054 a FR-058). El personal ve los de todos; el cliente solo el suyo,
// tomado de la sesión (nunca de la petición); el entrenador no tiene avisos (403).
export function crearAvisosService({ avisoModelo = avisoModeloReal } = {}) {
  async function listar(actor) {
    let idCliente;
    if (actor?.rol === 'cliente') {
      if (actor.id_cliente === undefined || actor.id_cliente === null) throw errorNoEncontrado('Tu cuenta no está vinculada a un cliente.');
      idCliente = actor.id_cliente;
    } else if (!PERSONAL.includes(actor?.rol)) {
      throw errorSinPermiso();
    }
    const filas = await avisoModelo.listar({ idCliente });
    const avisos = filas.map((f) => {
      const dias = Number(f.dias);
      return {
        id_membresia: f.id_membresia,
        tipo: dias < 0 ? 'vencida' : 'por_vencer',
        dias,
        fecha_fin: f.fecha_fin,
        plan: f.plan,
        cliente: { id_cliente: f.id_cliente, nombre: f.nombre, apellido: f.apellido },
      };
    });
    return { total: avisos.length, avisos };
  }
  return { listar };
}

export const { listar } = crearAvisosService();
