import * as servicio from '../services/entrenamiento.service.js';

// GET /api/clientes/:id/entrenamiento
export async function obtener(req, res) {
  res.json(await servicio.obtener(req.validado.params.id, req.usuario));
}

// GET /api/rutinas/:id
export async function obtenerRutina(req, res) {
  res.json(await servicio.obtenerRutina(req.validado.params.id, req.usuario));
}

// POST /api/clientes/:id/rutinas
export async function crearRutina(req, res) {
  res.status(201).json(await servicio.crearRutina(req.validado.params.id, req.validado.body, req.usuario));
}
