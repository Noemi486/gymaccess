import { z } from 'zod';
import './mensajes.js'; // mensajes de zod en español
import { descriptorEsquema } from './descriptor.validator.js';

// POST /api/accesos/identificar: solo el descriptor (128 números). Nunca imágenes.
export const identificarEsquema = z.strictObject({
  descriptor: descriptorEsquema,
});

// Fecha real en formato AAAA-MM-DD (rechaza 2026-02-30).
const fechaEsquema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'La fecha debe tener el formato AAAA-MM-DD.' })
  .refine(
    (valor) => {
      const fecha = new Date(`${valor}T00:00:00Z`);
      return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
    },
    { error: 'La fecha no es válida.' },
  );

// GET /api/accesos?desde=&hasta=&resultado=&q=&page=&limit=
// page y limit se leen luego con leerPaginacion (valores no válidos usan los predeterminados).
export const accesoListarQueryEsquema = z
  .object({
    desde: fechaEsquema.optional(),
    hasta: fechaEsquema.optional(),
    resultado: z.enum(['autorizado', 'rechazado'], { error: 'El resultado debe ser autorizado o rechazado.' }).optional(),
    q: z
      .string()
      .trim()
      .max(150)
      .optional()
      .transform((valor) => (valor === '' ? undefined : valor)),
    page: z.string().optional(),
    limit: z.string().optional(),
  })
  .superRefine((datos, contexto) => {
    if (datos.desde && datos.hasta && datos.desde > datos.hasta) {
      contexto.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial.' });
    }
  });
