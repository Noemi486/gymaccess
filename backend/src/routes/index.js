import { Router } from 'express';
import accesosRoutes from './accesos.routes.js';
import authRoutes from './auth.routes.js';
import clientesRoutes from './clientes.routes.js';
import membresiasRoutes from './membresias.routes.js';
import pagosRoutes from './pagos.routes.js';
import rostrosRoutes from './rostros.routes.js';
import resumenRoutes from './resumen.routes.js';
import tiposMembresiaRoutes from './tiposMembresia.routes.js';
import usuariosRoutes from './usuarios.routes.js';

// Router principal de la API (se monta bajo /api).
// Cada historia de usuario agrega aquí su router:
//   /auth      (Sprint 1 - US1)
//   /usuarios  (Sprint 1 - US2)
//   /clientes  (Sprint 1 - US3, US4, US5)
//   /resumen   (Interfaz - resumen del inicio, solo lectura)
const router = Router();

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/clientes', clientesRoutes);
router.use('/resumen', resumenRoutes);
router.use('/tipos-membresia', tiposMembresiaRoutes);
router.use('/pagos', pagosRoutes);
router.use('/accesos', accesosRoutes);
router.use('/', rostrosRoutes);
router.use('/', membresiasRoutes); // /clientes/:id/membresias y /membresias/:id/... (después de /clientes)

export default router;
