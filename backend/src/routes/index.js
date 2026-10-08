import { Router } from 'express';
import authRoutes from './auth.routes.js';
import clientesRoutes from './clientes.routes.js';
import usuariosRoutes from './usuarios.routes.js';

// Router principal de la API (se monta bajo /api).
// Cada historia de usuario agrega aquí su router:
//   /auth      (Sprint 1 - US1)
//   /usuarios  (Sprint 1 - US2)
//   /clientes  (Sprint 1 - US3, US4, US5)
const router = Router();

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/clientes', clientesRoutes);

export default router;
