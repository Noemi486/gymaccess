import * as membresiasService from '../services/membresias.service.js';

// GET /api/clientes/:id/membresias
export async function listarDeCliente(req, res) {
  res.json(await membresiasService.listarDeCliente(req.validado.params.id));
}

// POST /api/clientes/:id/membresias
export async function asignar(req, res) {
  res.status(201).json(await membresiasService.asignar(req.validado.params.id, req.validado.body, req.usuario));
}

// POST /api/membresias/:id/renovar
export async function renovar(req, res) {
  res.status(201).json(await membresiasService.renovar(req.validado.params.id, req.validado.body, req.usuario));
}

// PATCH /api/membresias/:id/estado
export async function cambiarEstado(req, res) {
  const { accion } = req.validado.body;
  res.json(await membresiasService.cambiarEstado(req.validado.params.id, accion, req.usuario));
}
