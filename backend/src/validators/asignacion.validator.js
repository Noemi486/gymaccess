import { z } from 'zod';

// PUT /api/clientes/:id/entrenador (spec 004, FR-005): un id de entrenador asigna o cambia; null quita.
export const asignacionEsquema = z.strictObject({
  id_entrenador: z
    .number({ error: 'Elige un entrenador.' })
    .int({ error: 'Elige un entrenador.' })
    .positive({ error: 'Elige un entrenador.' })
    .nullable(),
});
