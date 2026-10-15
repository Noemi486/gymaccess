import { Router } from 'express';
import { cambiarEstado, consultar, registrar } from '../controllers/rostros.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { idParamEsquema } from '../validators/comunes.js';
import { rostroEstadoEsquema, rostroRegistrarEsquema } from '../validators/rostro.validator.js';

// Se monta en la raíz de /api (mezcla /clientes/:id/rostro y /rostros/:id). Cada ruta lleva su `autenticar`.
const router = Router();
const operadores = ['administrador', 'recepcionista'];

router.get('/clientes/:id/rostro', autenticar, autorizar(...operadores), validar(idParamEsquema, 'params'), consultar);
router.post(
  '/clientes/:id/rostro',
  autenticar,
  autorizar(...operadores),
  validar(idParamEsquema, 'params'),
  validar(rostroRegistrarEsquema),
  registrar,
);

// Desactivar y reactivar: solo el administrador. No existe ninguna ruta DELETE: nada se borra.
router.patch(
  '/rostros/:id/estado',
  autenticar,
  autorizar('administrador'),
  validar(idParamEsquema, 'params'),
  validar(rostroEstadoEsquema),
  cambiarEstado,
);

export default router;
