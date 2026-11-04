import { z } from 'zod';
import { busquedaEsquema, fechaEsquema } from './comunes.js';

// Rutinas, objetivos y avances (spec 004, FR-009 a FR-014). Los mismos límites que los CHECK de la migración 03.

const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .nullable()
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v));

// Para ediciones parciales: '' borra el dato (null) y un campo no enviado sigue sin enviarse (undefined).
const textoParcial = (max) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

const numeroBase = (min, max, etiqueta, decimales) =>
  z
    .number({ error: `${etiqueta} debe ser un número.` })
    .min(min, { error: `${etiqueta} debe estar entre ${min} y ${max}.` })
    .max(max, { error: `${etiqueta} debe estar entre ${min} y ${max}.` })
    .refine((v) => Number.isInteger(Math.round(v * 10 ** decimales * 1e6) / 1e6), {
      error: `${etiqueta} admite hasta ${decimales} decimales.`,
    });

// En altas: un campo no enviado queda en null.
const numeroEnRango = (min, max, etiqueta, decimales) =>
  numeroBase(min, max, etiqueta, decimales)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? null : v));
// En correcciones: un campo no enviado no se toca.
const numeroParcial = (min, max, etiqueta, decimales) => numeroBase(min, max, etiqueta, decimales).nullable().optional();

// --- Rutinas ---

export const ejercicioEsquema = z
  .strictObject({
    nombre: z.string().trim().min(1, { error: 'El nombre del ejercicio es obligatorio.' }).max(100, { error: 'Máximo 100 caracteres.' }),
    series: z
      .number({ error: 'Las series deben ser un número.' })
      .int({ error: 'Las series deben ser un número entero.' })
      .min(1, { error: 'Las series deben estar entre 1 y 20.' })
      .max(20, { error: 'Las series deben estar entre 1 y 20.' })
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? null : v)),
    repeticiones: textoOpcional(30),
    peso_kg: numeroEnRango(0, 500, 'El peso', 2),
    descanso_seg: z
      .number({ error: 'El descanso debe ser un número.' })
      .int({ error: 'El descanso debe ser un número entero de segundos.' })
      .min(0, { error: 'El descanso debe estar entre 0 y 600 segundos.' })
      .max(600, { error: 'El descanso debe estar entre 0 y 600 segundos.' })
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? null : v)),
    instrucciones: textoOpcional(300),
  })
  .refine((e) => e.series !== null || e.repeticiones !== null || e.instrucciones !== null, {
    error: 'Indica series, repeticiones o instrucciones.',
    path: ['series'],
  });

const diaEsquema = z.strictObject({
  dia: z
    .number({ error: 'El día no es válido.' })
    .int({ error: 'El día no es válido.' })
    .min(1, { error: 'El día debe estar entre 1 y 7.' })
    .max(7, { error: 'El día debe estar entre 1 y 7.' }),
  ejercicios: z.array(ejercicioEsquema).max(20, { error: 'Máximo 20 ejercicios por día.' }),
});

// POST /api/clientes/:id/rutinas. Los días sin ejercicios se descartan; se exige al menos un ejercicio en total.
export const rutinaCrearEsquema = z
  .strictObject({
    nombre: z.string().trim().min(1, { error: 'El nombre de la rutina es obligatorio.' }).max(100, { error: 'Máximo 100 caracteres.' }),
    indicaciones: textoOpcional(500),
    dias: z.array(diaEsquema).max(7, { error: 'Máximo 7 días.' }),
  })
  .superRefine((r, ctx) => {
    const vistos = new Set();
    r.dias.forEach((d, i) => {
      if (vistos.has(d.dia)) ctx.addIssue({ code: 'custom', path: ['dias', i, 'dia'], message: `El día ${d.dia} está repetido.` });
      vistos.add(d.dia);
    });
    if (!r.dias.some((d) => d.ejercicios.length > 0)) {
      ctx.addIssue({ code: 'custom', path: ['dias'], message: 'Agrega al menos un ejercicio.' });
    }
  })
  .transform((r) => ({
    ...r,
    dias: r.dias.filter((d) => d.ejercicios.length > 0).sort((a, b) => a.dia - b.dia),
  }));

// --- Objetivos ---

export const objetivoCrearEsquema = z.strictObject({
  descripcion: z.string().trim().min(1, { error: 'La descripción es obligatoria.' }).max(200, { error: 'Máximo 200 caracteres.' }),
  meta: textoOpcional(100),
  fecha_limite: fechaEsquema.nullable().optional().transform((v) => v ?? null),
});

// PATCH /api/objetivos/:id: editar (en curso) o cerrar, no ambas cosas a la vez.
export const objetivoActualizarEsquema = z
  .strictObject({
    descripcion: z.string().trim().min(1, { error: 'La descripción es obligatoria.' }).max(200, { error: 'Máximo 200 caracteres.' }).optional(),
    meta: textoParcial(100),
    fecha_limite: fechaEsquema.nullable().optional(),
    estado: z.enum(['cumplido', 'cancelado'], { error: 'El estado debe ser cumplido o cancelado.' }).optional(),
  })
  .superRefine((d, ctx) => {
    const enviados = Object.keys(d).filter((k) => d[k] !== undefined);
    if (enviados.length === 0) ctx.addIssue({ code: 'custom', path: [], message: 'Envía al menos un campo a modificar.' });
    if (d.estado !== undefined && enviados.length > 1) {
      ctx.addIssue({ code: 'custom', path: ['estado'], message: 'Para cerrar un objetivo envía solo el estado.' });
    }
  });

// --- Avances ---

const camposAvance = {
  peso_kg: numeroEnRango(20, 400, 'El peso', 2),
  grasa_pct: numeroEnRango(2, 70, 'El porcentaje de grasa', 1),
  cintura_cm: numeroEnRango(30, 250, 'La cintura', 1),
  comentario: textoOpcional(500),
};
const tieneDato = (a) => a.peso_kg !== null || a.grasa_pct !== null || a.cintura_cm !== null || a.comentario !== null;

export const progresoCrearEsquema = z
  .strictObject({ fecha: fechaEsquema, ...camposAvance })
  .refine(tieneDato, { error: 'Registra al menos el peso, el porcentaje de grasa, la cintura o un comentario.', path: ['peso_kg'] });

// PATCH /api/progresos/:id: los campos enviados reemplazan a los guardados; el servicio revisa que quede al menos un dato.
export const progresoActualizarEsquema = z
  .strictObject({
    fecha: fechaEsquema.optional(),
    peso_kg: numeroParcial(20, 400, 'El peso', 2),
    grasa_pct: numeroParcial(2, 70, 'El porcentaje de grasa', 1),
    cintura_cm: numeroParcial(30, 250, 'La cintura', 1),
    comentario: textoParcial(500),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { error: 'Envía al menos un campo a corregir.' });

// GET /api/entrenamiento/mis-clientes?q=&page=&limit=
export const misClientesQueryEsquema = z.object({
  q: busquedaEsquema,
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
