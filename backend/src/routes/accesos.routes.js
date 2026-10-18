import { Router } from 'express';
import { identificar, listar } from '../controllers/accesos.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { crearLimitador, limitarPorUsuario } from '../utils/limitador.js';
import { accesoListarQueryEsquema, identificarEsquema } from '../validators/acceso.validator.js';

// /api/accesos. Los accesos son un registro: no existe ninguna ruta para editarlos ni eliminarlos.
const router = Router();

// Máximo 30 identificaciones por minuto por usuario: frena el abuso sin estorbar a la estación (~1 cada 2 s).
const limitador = crearLimitador({ maximo: 30, ventanaMs: 60_000 });

router.post(
  '/identificar',
  autenticar,
  autorizar('administrador', 'recepcionista'),
  limitarPorUsuario(limitador),
  validar(identificarEsquema),
  identificar,
);

// Consultar: administrador, recepcionista y entrenador (el servicio limita lo que ve el entrenador).
router.get('/', autenticar, autorizar('administrador', 'recepcionista', 'entrenador'), validar(accesoListarQueryEsquema, 'query'), listar);

export default router;
