import * as tiposService from '../services/tiposMembresia.service.js';
import { leerPaginacion } from '../utils/paginacion.js';

// GET /api/tipos-membresia
export async function listar(req, res) {
  const { q, estado, ...paginacion } = req.validado.query;
  const { page, limit, offset } = leerPaginacion(paginacion);
  res.json(await tiposService.listar({ q, estado, page, limit, offset }, req.usuario));
}

// GET /api/tipos-membresia/:id
export async function obtener(req, res) {
  res.json(await tiposService.obtener(req.validado.params.id, req.usuario));
}

// POST /api/tipos-membresia
export async function crear(req, res) {
  res.status(201).json(await tiposService.crear(req.validado.body, req.usuario));
}

// PATCH /api/tipos-membresia/:id
export async function actualizar(req, res) {
  res.json(await tiposService.actualizar(req.validado.params.id, req.validado.body, req.usuario));
}

// PATCH /api/tipos-membresia/:id/estado
export async function cambiarEstado(req, res) {
  const { estado } = req.validado.body;
  res.json(await tiposService.cambiarEstado(req.validado.params.id, estado, req.usuario));
}
