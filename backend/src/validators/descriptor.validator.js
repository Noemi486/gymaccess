import { z } from 'zod';
import './mensajes.js'; // mensajes de zod en español

// Descriptor facial recibido del navegador: un arreglo de EXACTAMENTE 128 números finitos, cada uno
// entre -5 y 5 (los reales de la biblioteca rondan -1 y 1), y que no sea todo ceros.
// Los mensajes nunca repiten los valores recibidos.
const LIMITE = 5;

export const descriptorEsquema = z
  .array(z.number({ error: 'El descriptor solo admite números.' }).finite('El descriptor solo admite números finitos.'), {
    error: 'El descriptor facial debe ser una lista de 128 números.',
  })
  .length(128, { error: 'El descriptor facial debe tener exactamente 128 valores.' })
  .refine((valores) => valores.every((v) => v >= -LIMITE && v <= LIMITE), {
    error: `El descriptor tiene valores fuera del rango permitido (-${LIMITE} a ${LIMITE}).`,
  })
  .refine((valores) => valores.some((v) => v !== 0), {
    error: 'El descriptor facial no es válido.',
  });
