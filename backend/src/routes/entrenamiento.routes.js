import { Router } from 'express';
import { crearRutina, obtener, obtenerRutina } from '../controllers/entrenamiento.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { autorizar } from '../middlewares/autorizar.js';
import { validar } from '../middlewares/validar.js';
import { idParamEsquema } from '../validators/comunes.js';
import { rutinaCrearEsquema } from '../validators/entrenamiento.validator.js';

// Entrenamiento (spec 004, US3 y US4). Se monta en "/". El servicio revisa además que el entrenador
// tenga asignado al cliente (FR-017) y que el administrador solo consulte (FR-018).
const router = Router();
const id = validar(idParamEsquema, 'params');
const consultan = autorizar('entrenador', 'administrador');
const registra = autorizar('entrenador');

router.get('/clientes/:id/entrenamiento', autenticar, consultan, id, obtener);
router.post('/clientes/:id/rutinas', autenticar, registra, id, validar(rutinaCrearEsquema), crearRutina);
router.get('/rutinas/:id', autenticar, consultan, id, obtenerRutina);

export default router;
