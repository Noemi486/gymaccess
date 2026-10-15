import { z } from 'zod';
import './mensajes.js'; // mensajes de zod en español
import { aCentavos, deCentavos } from '../utils/dinero.js';

// Pagos (data-model.md, tabla pagos): un solo pago por membresía, por el monto completo.

const MENSAJE_MONTO = 'El monto debe ser mayor a 0, con a lo más 2 decimales.';
const MONTO_MAXIMO_CENTAVOS = 9_999_999_999;

// monto: número o texto positivo con ≤ 2 decimales. Se normaliza a número con dos decimales.
const montoEsquema = z
  .union([z.number({ error: MENSAJE_MONTO }), z.string({ error: MENSAJE_MONTO })], { error: MENSAJE_MONTO })
  .transform((valor, contexto) => {
    try {
      const centavos = aCentavos(valor);
      if (centavos <= 0 || centavos > MONTO_MAXIMO_CENTAVOS) throw new Error('fuera de rango');
      return deCentavos(centavos);
    } catch {
      contexto.addIssue({ code: 'custom', message: MENSAJE_MONTO });
      return z.NEVER;
    }
  });

const metodoEsquema = z.enum(['efectivo', 'tarjeta', 'transferencia'], {
  error: 'Elige un método de pago: efectivo, tarjeta o transferencia.',
});

// POST /api/pagos
export const pagoCrearEsquema = z.strictObject({
  id_membresia: z
    .number({ error: 'La membresía no es válida.' })
    .int({ error: 'La membresía no es válida.' })
    .positive({ error: 'La membresía no es válida.' }),
  metodo_pago: metodoEsquema,
  monto: montoEsquema,
});

// Objeto `pago` anidado al asignar o renovar una membresía.
export const pagoEnLineaEsquema = z.strictObject({
  metodo_pago: metodoEsquema,
  monto: montoEsquema,
});
