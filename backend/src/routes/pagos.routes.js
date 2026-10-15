import { Router } from 'express';
import { registrar } from '../controllers/pagos.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { pagoCrearEsquema } from '../validators/pago.validator.js';

const router = Router();

router.use(autenticar);

// Registrar un pago: administrador y recepcionista. Un pago no se edita ni se borra:
// no existen rutas PUT, PATCH ni DELETE.
router.post('/', autorizar('administrador', 'recepcionista'), validar(pagoCrearEsquema), registrar);

export default router;
