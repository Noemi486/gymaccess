import { z } from 'zod';
import { busquedaEsquema, correoEsquema, estadoEsquema } from './comunes.js';
import { passwordEsquema } from './usuario.validator.js';

// Entrenadores (spec 004, FR-001 a FR-003). Restricciones de usuarios y de la tabla entrenadores.

const nombreEsquema = z.string().trim().min(1, { error: 'El nombre es obligatorio.' }).max(120);
// Opcionales: vacío equivale a "sin dato" (null en la base).
const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));
const telefonoEsquema = textoOpcional(20).refine((v) => v == null || /^[0-9+()\-\s]{7,20}$/.test(v), {
  error: 'El teléfono solo puede tener números, espacios, +, - y paréntesis (7 a 20 caracteres).',
});

// POST /api/entrenadores (cuenta + ficha)
export const entrenadorCrearEsquema = z.strictObject({
  nombre: nombreEsquema,
  correo: correoEsquema,
  password: passwordEsquema,
  telefono: telefonoEsquema,
  especialidad: textoOpcional(100),
});

// PATCH /api/entrenadores/:id (al menos un campo)
export const entrenadorActualizarEsquema = z
  .strictObject({
    nombre: nombreEsquema.optional(),
    telefono: telefonoEsquema,
    especialidad: textoOpcional(100),
  })
  .refine((datos) => Object.keys(datos).length > 0, { error: 'Envía al menos un campo a modificar.' });

// PATCH /api/entrenadores/:id/estado
export const entrenadorEstadoEsquema = z.strictObject({ estado: estadoEsquema });

// GET /api/entrenadores?q=&estado=&page=&limit=
export const entrenadorListarQueryEsquema = z.object({
  q: busquedaEsquema,
  estado: estadoEsquema.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
