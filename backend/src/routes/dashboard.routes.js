import { Router } from 'express';
import { obtener } from '../controllers/dashboard.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { dashboardQueryEsquema } from '../validators/dashboard.validator.js';

// /api/dashboard: solo el administrador (FR-041). Solo lectura.
const router = Router();

router.get('/', autenticar, autorizar('administrador'), validar(dashboardQueryEsquema, 'query'), obtener);

export default router;
