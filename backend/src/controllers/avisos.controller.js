import * as avisosService from '../services/avisos.service.js';

// GET /api/avisos
export async function listar(req, res) {
  res.json(await avisosService.listar(req.usuario));
}
