import * as servicio from '../services/miEntrenamiento.service.js';

// GET /api/clientes/me/entrenamiento
export async function obtener(req, res) {
  res.json(await servicio.obtener(req.usuario));
}
