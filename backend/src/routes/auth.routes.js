import { Router } from 'express';
import { login, me } from '../controllers/auth.controller.js';
import { autenticar } from '../middlewares/autenticar.js';
import { validar } from '../middlewares/validar.js';
import { loginEsquema } from '../validators/auth.validator.js';

const router = Router();

router.post('/login', validar(loginEsquema), login);
router.get('/me', autenticar, me);

export default router;
