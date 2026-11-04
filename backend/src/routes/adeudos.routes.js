import { Router } from 'express';
import { listarAdeudos } from '../controllers/pagos.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { adeudoListarQueryEsquema } from '../validators/pago.validator.js';

// /api/adeudos: solo lectura. El adeudo se deriva de las membresías sin pago (no se guarda).
const router = Router();

router.get('/', autenticar, autorizar('administrador', 'recepcionista'), validar(adeudoListarQueryEsquema, 'query'), listarAdeudos);

export default router;
