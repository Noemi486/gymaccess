import { z } from 'zod';
import './mensajes.js'; // mensajes de zod en español
import { descriptorEsquema } from './descriptor.validator.js';

// POST /api/clientes/:id/rostro: el consentimiento debe venir explícitamente en true.
export const rostroRegistrarEsquema = z.strictObject({
  descriptor: descriptorEsquema,
  consentimiento: z.literal(true, { error: 'Se requiere el consentimiento del cliente para registrar su rostro.' }),
});

// PATCH /api/rostros/:id/estado
export const rostroEstadoEsquema = z.strictObject({
  estado: z.enum(['activo', 'inactivo'], { error: 'El estado debe ser activo o inactivo.' }),
});
