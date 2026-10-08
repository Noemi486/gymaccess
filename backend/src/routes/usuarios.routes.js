import { Router } from 'express';
import { actualizar, crear, listar, obtener } from '../controllers/usuarios.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { idParamEsquema } from '../validators/comunes.js';
import {
  usuarioActualizarEsquema,
  usuarioCrearEsquema,
  usuarioListarQueryEsquema,
} from '../validators/usuario.validator.js';

const router = Router();

// La gestión de usuarios y roles es exclusiva del administrador (FR-008).
router.use(autenticar, autorizar('administrador'));

router.get('/', validar(usuarioListarQueryEsquema, 'query'), listar);
router.post('/', validar(usuarioCrearEsquema), crear);
router.get('/:id', validar(idParamEsquema, 'params'), obtener);
router.patch('/:id', validar(idParamEsquema, 'params'), validar(usuarioActualizarEsquema), actualizar);

export default router;
