import * as servicio from '../services/entrenadores.service.js';
import { leerPaginacion } from '../utils/paginacion.js';

// GET /api/entrenadores
export async function listar(req, res) {
  const { q, estado, ...paginacion } = req.validado.query;
  const { page, limit, offset } = leerPaginacion(paginacion);
  res.json(await servicio.listar({ q, estado, page, limit, offset }));
}

// GET /api/entrenadores/:id
export async function obtener(req, res) {
  res.json(await servicio.obtener(req.validado.params.id));
}

// POST /api/entrenadores
export async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.validado.body, req.usuario));
}

// PATCH /api/entrenadores/:id
export async function actualizar(req, res) {
  res.json(await servicio.actualizar(req.validado.params.id, req.validado.body, req.usuario));
}

// PATCH /api/entrenadores/:id/estado
export async function cambiarEstado(req, res) {
  res.json(await servicio.cambiarEstado(req.validado.params.id, req.validado.body.estado, req.usuario));
}
