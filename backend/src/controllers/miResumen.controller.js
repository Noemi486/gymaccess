import * as miResumenService from '../services/miResumen.service.js';

// GET /api/clientes/me/resumen
export async function obtener(req, res) {
  res.json(await miResumenService.obtener(req.usuario));
}
