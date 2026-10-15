import { Router } from 'express';
import { asignar, cambiarEstado, listarDeCliente, renovar } from '../controllers/membresias.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { idParamEsquema } from '../validators/comunes.js';
import { membresiaAsignarEsquema, membresiaEstadoEsquema, membresiaRenovarEsquema } from '../validators/membresia.validator.js';

// Se monta en la raíz de /api porque mezcla rutas bajo /clientes/:id y bajo /membresias/:id.
// Cada ruta lleva su propio `autenticar` para no interceptar peticiones de otros routers.
const router = Router();
const operadores = ['administrador', 'recepcionista'];

router.get('/clientes/:id/membresias', autenticar, autorizar(...operadores), validar(idParamEsquema, 'params'), listarDeCliente);
router.post(
  '/clientes/:id/membresias',
  autenticar,
  autorizar(...operadores),
  validar(idParamEsquema, 'params'),
  validar(membresiaAsignarEsquema),
  asignar,
);
router.post(
  '/membresias/:id/renovar',
  autenticar,
  autorizar(...operadores),
  validar(idParamEsquema, 'params'),
  validar(membresiaRenovarEsquema),
  renovar,
);

// Suspender, reactivar y cancelar: solo el administrador. No existe ninguna ruta DELETE.
router.patch(
  '/membresias/:id/estado',
  autenticar,
  autorizar('administrador'),
  validar(idParamEsquema, 'params'),
  validar(membresiaEstadoEsquema),
  cambiarEstado,
);

export default router;
