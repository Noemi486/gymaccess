import * as dashboardService from '../services/dashboard.service.js';

// GET /api/dashboard
export async function obtener(req, res) {
  res.json(await dashboardService.obtener(req.validado.query));
}
