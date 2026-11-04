import * as pagosService from '../services/pagos.service.js';
import { leerPaginacion } from '../utils/paginacion.js';

// POST /api/pagos
export async function registrar(req, res) {
  res.status(201).json(await pagosService.registrar(req.validado.body, req.usuario));
}

// GET /api/pagos
export async function listar(req, res) {
  const { desde, hasta, metodo_pago, q, ...paginacion } = req.validado.query;
  const { page, limit, offset } = leerPaginacion(paginacion);
  res.json(await pagosService.listar({ desde, hasta, metodo_pago, q, page, limit, offset }));
}

// GET /api/adeudos
export async function listarAdeudos(req, res) {
  const { q, ...paginacion } = req.validado.query;
  const { page, limit, offset } = leerPaginacion(paginacion);
  res.json(await pagosService.listarAdeudos({ q, page, limit, offset }));
}
