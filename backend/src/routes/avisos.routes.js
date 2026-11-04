import { Router } from 'express';
import { listar } from '../controllers/avisos.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';

// /api/avisos: solo lectura. Avisos derivados de membresías por vencer y vencidas (US12).
const router = Router();

router.get('/', autenticar, autorizar('administrador', 'recepcionista', 'cliente'), listar);

export default router;
