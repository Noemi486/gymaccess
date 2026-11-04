import { Router } from 'express';
import { listar, registrar } from '../controllers/pagos.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { pagoCrearEsquema, pagoListarQueryEsquema } from '../validators/pago.validator.js';

const router = Router();

router.use(autenticar);

// Consultar el historial y registrar un pago: administrador y recepcionista. Un pago no se edita ni se borra:
// no existen rutas PUT, PATCH ni DELETE.
router.get('/', autorizar('administrador', 'recepcionista'), validar(pagoListarQueryEsquema, 'query'), listar);
router.post('/', autorizar('administrador', 'recepcionista'), validar(pagoCrearEsquema), registrar);

export default router;
