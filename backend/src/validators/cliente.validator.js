import { z } from 'zod';
import { normalizarCorreo } from '../utils/correo.js';
import { estadoEsquema } from './comunes.js';

// Restricciones tomadas de data-model.md (tabla `clientes`).

// nombre y apellido: VARCHAR(80) NOT NULL, no vacío tras TRIM
const nombreEsquema = z.string().trim().min(1).max(80);

// telefono: VARCHAR(20) NOT NULL, no vacío tras TRIM; solo dígitos, espacios, +, -, ( y )
const telefonoEsquema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[0-9+\-() ]+$/, { error: 'El teléfono solo puede llevar dígitos, espacios, +, -, ( y ).' });

// correo: VARCHAR(150) NULL, UNIQUE. Opcional: "" o espacios (o null) significan "sin correo"
// y se guardan como NULL; si viene, va en minúsculas y con formato de correo válido.
// Si el campo no se envía (undefined) se deja tal cual para que un PATCH no lo toque.
const correoOpcionalEsquema = z
  .string()
  .nullable()
  .optional()
  .transform((valor) => (valor === undefined ? undefined : normalizarCorreo(valor)))
  .pipe(z.email().max(150).nullable().optional());

// direccion: VARCHAR(255) NULL. Opcional: "" o espacios (o null) se guardan como NULL.
const direccionOpcionalEsquema = z
  .string()
  .nullable()
  .optional()
  .transform((valor) => {
    if (valor === undefined) return undefined;
    const limpia = valor === null ? '' : valor.trim();
    return limpia === '' ? null : limpia;
  })
  .pipe(z.string().max(255).nullable().optional());

// POST /api/clientes: nombre, apellido y teléfono obligatorios; correo y dirección opcionales.
// `estado`, `id_cliente` y `fecha_registro` no se aceptan (strictObject los rechaza).
export const clienteCrearEsquema = z.strictObject({
  nombre: nombreEsquema,
  apellido: nombreEsquema,
  telefono: telefonoEsquema,
  correo: correoOpcionalEsquema,
  direccion: direccionOpcionalEsquema,
});

// PATCH /api/clientes/:id (al menos un campo)
export const clienteActualizarEsquema = z
  .strictObject({
    nombre: nombreEsquema.optional(),
    apellido: nombreEsquema.optional(),
    telefono: telefonoEsquema.optional(),
    correo: correoOpcionalEsquema,
    direccion: direccionOpcionalEsquema,
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    error: 'Envía al menos un campo a modificar.',
  });

// GET /api/clientes?q=&estado=&page=&limit=
// q: búsqueda opcional (máximo 150, VARCHAR(150) del correo); en blanco equivale a sin búsqueda.
// page y limit se leen luego con leerPaginacion (valores no válidos usan los predeterminados).
export const clienteListarQueryEsquema = z.object({
  q: z
    .string()
    .trim()
    .max(150)
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
  estado: estadoEsquema.optional(),
  // Solo administrador: clientes activos, con correo y sin cuenta (para elegir a quién crear una cuenta).
  para_cuenta: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => valor === 'true'),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// PATCH /api/clientes/:id/estado
export const clienteEstadoEsquema = z.strictObject({
  estado: estadoEsquema,
});
