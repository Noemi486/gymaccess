import { ejecutarRespaldo, leerConfigRespaldo } from '../src/utils/respaldo.js';

// npm run respaldo  (lo ejecuta el Programador de tareas de Windows a las 23:00; ver docs/respaldo.md)
try {
  const resultado = await ejecutarRespaldo({ config: leerConfigRespaldo() });
  if (resultado.ok) {
    console.log(`Respaldo creado: ${resultado.archivo} (${resultado.bytes} bytes).`);
  } else {
    console.error(`El respaldo falló: ${resultado.mensaje}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`El respaldo falló: ${error.message}`);
  process.exitCode = 1;
}
