import app from './app.js';
import { env } from './config/env.js';

app.listen(env.puerto, () => {
  console.log(`API de GymAccess escuchando en el puerto ${env.puerto}`);
});
