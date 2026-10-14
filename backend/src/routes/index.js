import { Router } from 'express';
import authRoutes from './auth.routes.js';
import clientesRoutes from './clientes.routes.js';
import resumenRoutes from './resumen.routes.js';
import usuariosRoutes from './usuarios.routes.js';

// Router principal de la API (se monta bajo /api).
// Cada historia de usuario agrega aquí su router:
//   /auth      (Sprint 1 - US1)
//   /usuarios  (Sprint 1 - US2)
//   /clientes  (Sprint 1 - US3, US4, US5)
//   /resumen   (Interfaz - resumen del inicio, solo lectura)
const router = Router();

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/clientes', clientesRoutes);
router.use('/resumen', resumenRoutes);

export default router;
