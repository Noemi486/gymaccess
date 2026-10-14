import { Router } from 'express';
import { cambiarPassword, login, me } from '../controllers/auth.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { validar } from '../middlewares/validar.js';
import { loginEsquema, passwordCambioEsquema } from '../validators/auth.validator.js';

const router = Router();

router.post('/login', validar(loginEsquema), login);
router.get('/me', autenticar, me);

// Cambio de contraseña de la propia cuenta: cualquier usuario autenticado, de cualquier rol.
router.patch('/password', autenticar, validar(passwordCambioEsquema), cambiarPassword);

export default router;
