import * as servicio from '../services/asignaciones.service.js';
import { leerPaginacion } from '../utils/paginacion.js';

// GET /api/clientes/:id/entrenador
export async function obtener(req, res) {
  res.json(await servicio.obtener(req.validado.params.id));
}

// PUT /api/clientes/:id/entrenador
export async function asignar(req, res) {
  res.json(await servicio.asignar(req.validado.params.id, req.validado.body.id_entrenador, req.usuario));
}

// GET /api/entrenamiento/mis-clientes
export async function misClientes(req, res) {
  const { q, ...paginacion } = req.validado.query;
  const { page, limit, offset } = leerPaginacion(paginacion);
  res.json(await servicio.misClientes(req.usuario, { q, page, limit, offset }));
}
