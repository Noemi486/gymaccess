import { Router } from 'express';
import { actualizar, cambiarEstado, crear, listar, obtener } from '../controllers/tiposMembresia.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { idParamEsquema } from '../validators/comunes.js';
import {
  tipoActualizarEsquema,
  tipoCrearEsquema,
  tipoEstadoEsquema,
  tipoListarQueryEsquema,
} from '../validators/tipoMembresia.validator.js';

const router = Router();

router.use(autenticar);

// Consultar: administrador y recepcionista (el recepcionista solo ve planes activos; lo resuelve el servicio).
router.get('/', autorizar('administrador', 'recepcionista'), validar(tipoListarQueryEsquema, 'query'), listar);
router.get('/:id', autorizar('administrador', 'recepcionista'), validar(idParamEsquema, 'params'), obtener);

// Gestionar planes: solo el administrador. No existe ninguna ruta DELETE: la baja es lógica (estado).
router.post('/', autorizar('administrador'), validar(tipoCrearEsquema), crear);
router.patch('/:id', autorizar('administrador'), validar(idParamEsquema, 'params'), validar(tipoActualizarEsquema), actualizar);
router.patch(
  '/:id/estado',
  autorizar('administrador'),
  validar(idParamEsquema, 'params'),
  validar(tipoEstadoEsquema),
  cambiarEstado,
);

export default router;
