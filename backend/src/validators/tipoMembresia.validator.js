import { z } from 'zod';
import './mensajes.js'; // mensajes de zod en español
import { aCentavos, deCentavos } from '../utils/dinero.js';
import { estadoEsquema } from './comunes.js';

// Restricciones de data-model.md (tabla tipos_membresia), más estrictas que la base en el precio:
// la API exige precio MAYOR a 0 (no hay planes gratuitos, research R1).

const MENSAJE_PRECIO = 'El precio debe ser mayor a 0, con a lo más 2 decimales.';
const PRECIO_MAXIMO_CENTAVOS = 9_999_999_999; // 99 999 999,99

// nombre VARCHAR(80) NOT NULL, único (la unicidad se comprueba en el servicio y en la base)
const nombreEsquema = z.string({ error: 'Este campo es obligatorio.' }).trim().min(1).max(80);

// descripcion VARCHAR(255) NULL: el texto vacío se guarda como null
const descripcionEsquema = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .transform((valor) => (valor === '' ? null : valor));

// duracion: entero de 1 a 3650 días
const duracionEsquema = z
  .number({ error: 'La duración debe ser un número entero de días (1 a 3650).' })
  .int({ error: 'La duración debe ser un número entero de días (1 a 3650).' })
  .min(1, { error: 'La duración debe ser de al menos 1 día.' })
  .max(3650, { error: 'La duración no puede superar los 3650 días.' });

// precio: > 0, hasta 2 decimales, máximo 99 999 999,99. Acepta número o texto ("450", "450.50").
const precioEsquema = z
  .union([z.number({ error: MENSAJE_PRECIO }), z.string({ error: MENSAJE_PRECIO })], { error: MENSAJE_PRECIO })
  .transform((valor, contexto) => {
    try {
      const centavos = aCentavos(valor);
      if (centavos <= 0 || centavos > PRECIO_MAXIMO_CENTAVOS) throw new Error('fuera de rango');
      return deCentavos(centavos);
    } catch {
      contexto.addIssue({ code: 'custom', message: MENSAJE_PRECIO });
      return z.NEVER;
    }
  });

// POST /api/tipos-membresia
export const tipoCrearEsquema = z.strictObject({
  nombre: nombreEsquema,
  descripcion: descripcionEsquema.optional(),
  duracion: duracionEsquema,
  precio: precioEsquema,
});

// PATCH /api/tipos-membresia/:id (al menos un campo; el estado tiene su propia ruta)
export const tipoActualizarEsquema = z
  .strictObject({
    nombre: nombreEsquema.optional(),
    descripcion: descripcionEsquema.optional(),
    duracion: duracionEsquema.optional(),
    precio: precioEsquema.optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, { error: 'Envía al menos un campo a modificar.' });

// PATCH /api/tipos-membresia/:id/estado
export const tipoEstadoEsquema = z.strictObject({ estado: estadoEsquema });

// GET /api/tipos-membresia?estado=&q=&page=&limit=
export const tipoListarQueryEsquema = z.object({
  estado: estadoEsquema.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
