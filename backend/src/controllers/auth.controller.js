import * as authService from '../services/auth.service.js';

// POST /api/auth/login
export async function login(req, res) {
  const { correo, password } = req.validado.body;
  const sesion = await authService.iniciarSesion(correo, password);
  res.json(sesion);
}

// GET /api/auth/me
export function me(req, res) {
  res.json(authService.obtenerSesion(req.usuario));
}
