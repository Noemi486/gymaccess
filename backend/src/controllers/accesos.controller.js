import * as accesosService from '../services/accesos.service.js';

// POST /api/accesos/identificar: 200 aunque se rechace el acceso (el rechazo es un resultado, no un error).
export async function identificar(req, res) {
  res.json(await accesosService.identificar(req.validado.body.descriptor));
}
