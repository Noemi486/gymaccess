import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import rutas from './routes/index.js';
import { manejadorErrores, manejadorNoEncontrado } from './middlewares/manejadorErrores.js';

// Composición de la aplicación Express. No abre ningún puerto (eso lo hace server.js),
// para poder probar la API sin ocupar un puerto fijo.
const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: env.corsOrigen }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', rutas);

app.use(manejadorNoEncontrado);
app.use(manejadorErrores);

export default app;
