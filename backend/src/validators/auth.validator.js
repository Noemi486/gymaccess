import { z } from 'zod';

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
