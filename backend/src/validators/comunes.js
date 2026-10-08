import { z } from 'zod';

// Piezas de validación compartidas por los validadores de cada recurso.

// :id de la ruta, siempre un entero positivo.
export const idParamEsquema = z.object({
  id: z.coerce
    .number({ error: 'El identificador no es válido.' })
    .int({ error: 'El identificador no es válido.' })
    .positive({ error: 'El identificador no es válido.' }),
});

// Estados que usan las tablas usuarios y clientes.
export const estadoEsquema = z.enum(['activo', 'inactivo']);

// Correo: sin espacios sobrantes, en minúsculas, con formato válido y máximo 150 (VARCHAR(150)).
export const correoEsquema = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .transform((correo) => correo.toLowerCase())
  .pipe(z.email());
