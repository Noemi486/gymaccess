import { z } from 'zod';
import './mensajes.js'; // mensajes de zod en español
import { descriptorEsquema } from './descriptor.validator.js';
import { busquedaEsquema, fechaEsquema } from './comunes.js';

// POST /api/accesos/identificar: solo el descriptor (128 números). Nunca imágenes.
// Sprint 3 (spec 004, US8): `tipo` elige el modo de la estación (entrada por defecto).
export const identificarEsquema = z.strictObject({
  descriptor: descriptorEsquema,
  tipo: z.enum(['entrada', 'salida'], { error: 'El tipo debe ser entrada o salida.' }).optional(),
});

// GET /api/accesos?desde=&hasta=&resultado=&q=&page=&limit=
// page y limit se leen luego con leerPaginacion (valores no válidos usan los predeterminados).
export const accesoListarQueryEsquema = z
  .object({
    desde: fechaEsquema.optional(),
    hasta: fechaEsquema.optional(),
    resultado: z.enum(['autorizado', 'rechazado'], { error: 'El resultado debe ser autorizado o rechazado.' }).optional(),
    tipo: z.enum(['entrada', 'salida'], { error: 'El tipo debe ser entrada o salida.' }).optional(),
    q: busquedaEsquema,
    page: z.string().optional(),
    limit: z.string().optional(),
  })
  .superRefine((datos, contexto) => {
    if (datos.desde && datos.hasta && datos.desde > datos.hasta) {
      contexto.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial.' });
    }
  });
