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

// Fecha real en formato AAAA-MM-DD (rechaza 2026-02-30).
export const fechaEsquema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'La fecha debe tener el formato AAAA-MM-DD.' })
  .refine(
    (valor) => {
      const fecha = new Date(`${valor}T00:00:00Z`);
      return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
    },
    { error: 'La fecha no es válida.' },
  );

// Búsqueda libre opcional (por nombre de cliente): vacía equivale a no enviarla.
export const busquedaEsquema = z
  .string()
  .trim()
  .max(150)
  .optional()
  .transform((valor) => (valor === '' ? undefined : valor));
