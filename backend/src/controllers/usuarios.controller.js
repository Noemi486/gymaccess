import * as usuariosService from '../services/usuarios.service.js';
import { leerPaginacion } from '../utils/paginacion.js';

// GET /api/usuarios
export async function listar(req, res) {
  const { rol, estado, ...paginacion } = req.validado.query;
  const { page, limit, offset } = leerPaginacion(paginacion);
  res.json(await usuariosService.listar({ rol, estado, page, limit, offset }));
}

// GET /api/usuarios/:id
export async function obtener(req, res) {
  res.json(await usuariosService.obtener(req.validado.params.id));
}

// POST /api/usuarios
export async function crear(req, res) {
  const usuario = await usuariosService.crear(req.validado.body);
  res.status(201).json(usuario);
}

// PATCH /api/usuarios/:id
export async function actualizar(req, res) {
  res.json(await usuariosService.actualizar(req.validado.params.id, req.validado.body));
}
