import * as pagosService from '../services/pagos.service.js';

// POST /api/pagos
export async function registrar(req, res) {
  res.status(201).json(await pagosService.registrar(req.validado.body, req.usuario));
}
