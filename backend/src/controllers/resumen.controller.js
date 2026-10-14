import * as resumenService from '../services/resumen.service.js';

// GET /api/resumen
export async function obtener(req, res) {
  res.json(await resumenService.obtener(req.usuario));
}
