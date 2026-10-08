import * as clientesService from '../services/clientes.service.js';
import { leerPaginacion } from '../utils/paginacion.js';

// GET /api/clientes
export async function listar(req, res) {
  const { q, estado, para_cuenta: paraCuenta, ...paginacion } = req.validado.query;
  const { page, limit, offset } = leerPaginacion(paginacion);
  res.json(await clientesService.listar({ q, estado, page, limit, offset, paraCuenta }, req.usuario));
}

// GET /api/clientes/me
export async function propio(req, res) {
  res.json(await clientesService.obtenerPropio(req.usuario));
}

// GET /api/clientes/:id
export async function obtener(req, res) {
  res.json(await clientesService.obtener(req.validado.params.id, req.usuario));
}

// POST /api/clientes
export async function crear(req, res) {
  const cliente = await clientesService.crear(req.validado.body, req.usuario);
  res.status(201).json(cliente);
}

// PATCH /api/clientes/:id
export async function actualizar(req, res) {
  res.json(await clientesService.actualizar(req.validado.params.id, req.validado.body, req.usuario));
}

// PATCH /api/clientes/:id/estado
export async function cambiarEstado(req, res) {
  const { id } = req.validado.params;
  const { estado } = req.validado.body;
  res.json(await clientesService.cambiarEstado(id, estado, req.usuario));
}
