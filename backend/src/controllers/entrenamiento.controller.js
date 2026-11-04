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

// POST /api/clientes/:id/objetivos
export async function crearObjetivo(req, res) {
  res.status(201).json(await servicio.crearObjetivo(req.validado.params.id, req.validado.body, req.usuario));
}

// PATCH /api/objetivos/:id
export async function actualizarObjetivo(req, res) {
  res.json(await servicio.actualizarObjetivo(req.validado.params.id, req.validado.body, req.usuario));
}

// POST /api/clientes/:id/progresos
export async function crearProgreso(req, res) {
  res.status(201).json(await servicio.crearProgreso(req.validado.params.id, req.validado.body, req.usuario));
}

// PATCH /api/progresos/:id
export async function corregirProgreso(req, res) {
  res.json(await servicio.corregirProgreso(req.validado.params.id, req.validado.body, req.usuario));
}
