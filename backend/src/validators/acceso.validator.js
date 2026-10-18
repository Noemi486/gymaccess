import { z } from 'zod';
import './mensajes.js'; // mensajes de zod en español
import { descriptorEsquema } from './descriptor.validator.js';

// POST /api/accesos/identificar: solo el descriptor (128 números). Nunca imágenes.
export const identificarEsquema = z.strictObject({
  descriptor: descriptorEsquema,
});
