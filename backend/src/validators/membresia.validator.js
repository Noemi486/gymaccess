import { z } from 'zod';
import './mensajes.js'; // mensajes de zod en español

// Asignar y renovar membresías. El pago opcional (`pago`) se incorpora en la historia de pagos (US3).

const MENSAJE_FECHA = 'La fecha debe tener el formato AAAA-MM-DD y existir en el calendario.';

// Fecha "YYYY-MM-DD" que exista de verdad (rechaza 2026-02-30 y 2026-13-01).
const fechaEsquema = z
  .string({ error: MENSAJE_FECHA })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: MENSAJE_FECHA })
  .refine(
    (texto) => {
      const [anio, mes, dia] = texto.split('-').map(Number);
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));
      return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
    },
    { error: MENSAJE_FECHA },
  );

const MENSAJE_PLAN = 'Elige un plan de membresía válido.';
const idTipoEsquema = z
  .number({ error: MENSAJE_PLAN })
  .int({ error: MENSAJE_PLAN })
  .positive({ error: MENSAJE_PLAN });

// POST /api/clientes/:id/membresias
export const membresiaAsignarEsquema = z.strictObject({
  id_tipo_membresia: idTipoEsquema,
  fecha_inicio: fechaEsquema.optional(),
});

// POST /api/membresias/:id/renovar (el plan es el de la membresía que se renueva)
export const membresiaRenovarEsquema = z.strictObject({
  fecha_inicio: fechaEsquema.optional(),
});

// PATCH /api/membresias/:id/estado
export const membresiaEstadoEsquema = z.strictObject({
  accion: z.enum(['suspender', 'reactivar', 'cancelar'], { error: 'La acción debe ser suspender, reactivar o cancelar.' }),
});
