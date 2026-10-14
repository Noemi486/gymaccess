import { z } from 'zod';
import { MENSAJE_POLITICA, validarPoliticaContrasena } from '../utils/contrasena.js';
import { correoEsquema, estadoEsquema } from './comunes.js';

// Restricciones tomadas de data-model.md (tabla `usuarios`).

export const ROLES = ['administrador', 'recepcionista', 'entrenador', 'cliente'];
const rolEsquema = z.enum(ROLES);

// nombre VARCHAR(120) NOT NULL
const nombreEsquema = z.string().trim().min(1).max(120);

// 8 a 72 caracteres, al menos una letra y un número (FR-007a).
export const passwordEsquema = z.string().refine((valor) => validarPoliticaContrasena(valor) === null, {
  error: MENSAJE_POLITICA,
});

const idClienteEsquema = z.number().int().positive();

// POST /api/usuarios
export const usuarioCrearEsquema = z
  .strictObject({
    nombre: nombreEsquema,
    correo: correoEsquema,
    password: passwordEsquema,
    rol: rolEsquema,
    id_cliente: idClienteEsquema.optional(),
  })
  .superRefine((datos, contexto) => {
    // El esquema obliga: rol cliente => id_cliente; otros roles => sin id_cliente.
    if (datos.rol === 'cliente' && datos.id_cliente === undefined) {
      contexto.addIssue({
        code: 'custom',
        path: ['id_cliente'],
        message: 'El ID del cliente es obligatorio para el rol cliente.',
      });
    }
    if (datos.rol !== 'cliente' && datos.id_cliente !== undefined) {
      contexto.addIssue({
        code: 'custom',
        path: ['id_cliente'],
        message: 'Solo las cuentas con rol cliente llevan ID de cliente.',
      });
    }
  });

// PATCH /api/usuarios/:id (al menos un campo)
export const usuarioActualizarEsquema = z
  .strictObject({
    nombre: nombreEsquema.optional(),
    correo: correoEsquema.optional(),
    password: passwordEsquema.optional(),
    rol: rolEsquema.optional(),
    estado: estadoEsquema.optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    error: 'Envía al menos un campo a modificar.',
  });

// GET /api/usuarios?rol=&estado=&page=&limit=
// page y limit se leen luego con leerPaginacion (valores no válidos usan los predeterminados).
export const usuarioListarQueryEsquema = z.object({
  rol: rolEsquema.optional(),
  estado: estadoEsquema.optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
