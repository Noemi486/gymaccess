import { Router } from 'express';
import { actualizar, cambiarEstado, crear, listar, obtener, propio } from '../controllers/clientes.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import {
  clienteActualizarEsquema,
  clienteCrearEsquema,
  clienteEstadoEsquema,
  clienteListarQueryEsquema,
} from '../validators/cliente.validator.js';
import { idParamEsquema } from '../validators/comunes.js';

const router = Router();

router.use(autenticar);

// Información propia: solo el rol cliente (FR-020). No recibe ningún id: el servicio usa el
// id_cliente de la sesión. IMPORTANTE: va ANTES de GET /:id para que "me" no se lea como un id.
router.get('/me', autorizar('cliente'), propio);

// Consultar: administrador, recepcionista y entrenador (FR-019). El entrenador recibe solo la
// información básica (lo resuelve el servicio). El rol cliente recibe 403 aquí.
const ROLES_CONSULTA = ['administrador', 'recepcionista', 'entrenador'];
router.get('/', autorizar(...ROLES_CONSULTA), validar(clienteListarQueryEsquema, 'query'), listar);
router.get('/:id', autorizar(...ROLES_CONSULTA), validar(idParamEsquema, 'params'), obtener);

// Registrar y modificar: administrador y recepcionista (FR-015, FR-016).
router.post('/', autorizar('administrador', 'recepcionista'), validar(clienteCrearEsquema), crear);
router.patch(
  '/:id',
  autorizar('administrador', 'recepcionista'),
  validar(idParamEsquema, 'params'),
  validar(clienteActualizarEsquema),
  actualizar,
);

// Baja lógica y reactivación: solo el administrador (FR-021). No existe ninguna ruta DELETE.
router.patch(
  '/:id/estado',
  autorizar('administrador'),
  validar(idParamEsquema, 'params'),
  validar(clienteEstadoEsquema),
  cambiarEstado,
);

export default router;
