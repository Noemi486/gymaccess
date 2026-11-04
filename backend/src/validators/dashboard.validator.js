import { z } from 'zod';
import './mensajes.js'; // mensajes de zod en español
import { fechaEsquema } from './comunes.js';

// GET /api/dashboard?periodo=hoy|semana|mes|rango&desde=&hasta=
// Las reglas que dependen de la fecha de hoy (sin fechas futuras, máximo 366 días) se validan en el servicio.
export const dashboardQueryEsquema = z
  .object({
    periodo: z.enum(['hoy', 'semana', 'mes', 'rango'], { error: 'El periodo debe ser hoy, semana, mes o rango.' }).optional(),
    desde: fechaEsquema.optional(),
    hasta: fechaEsquema.optional(),
  })
  .superRefine((datos, contexto) => {
    if (datos.periodo !== 'rango') return;
    if (!datos.desde) contexto.addIssue({ code: 'custom', path: ['desde'], message: 'Indica la fecha de inicio del rango.' });
    if (!datos.hasta) contexto.addIssue({ code: 'custom', path: ['hasta'], message: 'Indica la fecha final del rango.' });
    if (datos.desde && datos.hasta && datos.desde > datos.hasta) {
      contexto.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial.' });
    }
  });
