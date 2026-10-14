import { Router } from 'express';
import { obtener } from '../controllers/resumen.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';

const router = Router();

// Resumen del inicio: solo lectura, para el personal. El rol cliente recibe 403
// (consulta su información con GET /clientes/me). Cada rol recibe solo lo que le corresponde.
router.get('/', autenticar, autorizar('administrador', 'recepcionista', 'entrenador'), obtener);

export default router;
