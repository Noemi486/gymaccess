import * as accesosService from '../services/accesos.service.js';
import { leerPaginacion } from '../utils/paginacion.js';

// POST /api/accesos/identificar: 200 aunque se rechace el acceso (el rechazo es un resultado, no un error).
export async function identificar(req, res) {
  res.json(await accesosService.identificar(req.validado.body.descriptor));
}

// GET /api/accesos
export async function listar(req, res) {
  const { desde, hasta, resultado, q, ...paginacion } = req.validado.query;
  const { page, limit, offset } = leerPaginacion(paginacion);
  res.json(await accesosService.listar({ desde, hasta, resultado, q, page, limit, offset }, req.usuario));
}
