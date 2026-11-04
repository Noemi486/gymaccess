import { Router } from 'express';
import { actualizar, cambiarEstado, crear, listar, obtener } from '../controllers/entrenadores.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { idParamEsquema } from '../validators/comunes.js';
import {
  entrenadorActualizarEsquema,
  entrenadorCrearEsquema,
  entrenadorEstadoEsquema,
  entrenadorListarQueryEsquema,
} from '../validators/entrenador.validator.js';

// /api/entrenadores (spec 004, US1 y US7): el administrador gestiona; el recepcionista consulta.
const router = Router();
const personal = autorizar('administrador', 'recepcionista');
const soloAdmin = autorizar('administrador');
const id = validar(idParamEsquema, 'params');

router.get('/', autenticar, personal, validar(entrenadorListarQueryEsquema, 'query'), listar);
router.post('/', autenticar, soloAdmin, validar(entrenadorCrearEsquema), crear);
router.get('/:id', autenticar, personal, id, obtener);
router.patch('/:id', autenticar, soloAdmin, id, validar(entrenadorActualizarEsquema), actualizar);
router.patch('/:id/estado', autenticar, soloAdmin, id, validar(entrenadorEstadoEsquema), cambiarEstado);

export default router;
