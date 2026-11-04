import { Router } from 'express';
import { asignar, misClientes, obtener } from '../controllers/asignaciones.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { asignacionEsquema } from '../validators/asignacion.validator.js';
import { idParamEsquema } from '../validators/comunes.js';
import { misClientesQueryEsquema } from '../validators/entrenamiento.validator.js';

// Asignaciones (spec 004, US2 y US7). Se monta en "/" (rutas bajo /clientes/:id y /entrenamiento).
const router = Router();
const personal = autorizar('administrador', 'recepcionista');

router.get('/clientes/:id/entrenador', autenticar, personal, validar(idParamEsquema, 'params'), obtener);
router.put('/clientes/:id/entrenador', autenticar, personal, validar(idParamEsquema, 'params'), validar(asignacionEsquema), asignar);
router.get('/entrenamiento/mis-clientes', autenticar, autorizar('entrenador'), validar(misClientesQueryEsquema, 'query'), misClientes);

export default router;
