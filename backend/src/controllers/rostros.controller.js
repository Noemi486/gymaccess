import * as rostrosService from '../services/rostros.service.js';

// GET /api/clientes/:id/rostro
export async function consultar(req, res) {
  res.json(await rostrosService.consultar(req.validado.params.id));
}

// POST /api/clientes/:id/rostro
export async function registrar(req, res) {
  res.status(201).json(await rostrosService.registrar(req.validado.params.id, req.validado.body, req.usuario));
}

// PATCH /api/rostros/:id/estado
export async function cambiarEstado(req, res) {
  res.json(await rostrosService.cambiarEstado(req.validado.params.id, req.validado.body.estado, req.usuario));
}
