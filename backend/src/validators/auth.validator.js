import { z } from 'zod';
import { passwordEsquema } from './usuario.validator.js';

// Cuerpo de POST /api/auth/login. El correo se normaliza (sin espacios y en minúsculas);
// la contraseña no se recorta ni se le aplica la política: solo se compara con el hash.
export const loginEsquema = z.strictObject({
  correo: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .transform((correo) => correo.toLowerCase())
    .pipe(z.email()),
  password: z.string().min(1).max(200),
});

// Cuerpo de PATCH /api/auth/password. La cuenta es siempre la de la sesión: no se admite ningún id.
// La contraseña actual solo se compara con el hash; la nueva sigue la misma política que el alta
// de usuarios (8 a 72 caracteres, con al menos una letra y un número).
export const passwordCambioEsquema = z
  .strictObject({
    password_actual: z.string().min(1).max(200),
    password_nueva: passwordEsquema,
    password_confirmacion: z.string().min(1).max(200),
  })
  .superRefine((datos, contexto) => {
    if (datos.password_nueva !== datos.password_confirmacion) {
      contexto.addIssue({
        code: 'custom',
        path: ['password_confirmacion'],
        message: 'Las contraseñas no coinciden.',
      });
    }
  });
