# Contrato: PATCH /api/auth/password

Cambio de contraseña de la **propia cuenta** de cualquier usuario autenticado (administrador, recepcionista, entrenador y cliente). Endpoint nuevo aprobado por el equipo el 2026-10-13.

## Petición

Requiere sesión (`Authorization: Bearer <token>`). Cuerpo JSON, sin campos adicionales:

| Campo | Regla |
|---|---|
| `password_actual` | Texto de 1 a 200 caracteres. Se compara con el hash guardado (bcrypt). |
| `password_nueva` | Misma política que el alta de usuarios: 8 a 72 caracteres, al menos una letra y un número. Debe ser distinta de la actual. |
| `password_confirmacion` | Debe ser igual a `password_nueva`. |

La cuenta es siempre la de la sesión: el cuerpo **no admite ningún id** (un campo extra responde 400), así que nadie puede cambiar la contraseña de otra cuenta.

## Respuestas

| Estado | Cuándo | Cuerpo |
|---|---|---|
| 200 | Contraseña actualizada | `{ "message": "Contraseña actualizada correctamente." }` |
| 400 | Datos inválidos | `{ "error": { "code": "VALIDATION_ERROR", "message": "Revisa los datos enviados.", "details": [{ "field": "...", "message": "..." }] } }` |
| 401 | Sin sesión o sesión inválida | error estándar |
| 423 | Demasiados intentos fallidos de `password_actual` | `{ "error": { "code": "ACCOUNT_LOCKED", "message": "Demasiados intentos con la contraseña actual. Inténtalo de nuevo más tarde." } }` |

Mensajes por campo en `details`:

- `password_actual`: "La contraseña actual no es correcta."
- `password_nueva`: el mensaje de la política, o "La nueva contraseña debe ser distinta de la actual."
- `password_confirmacion`: "Las contraseñas no coinciden."

La contraseña actual incorrecta responde **400** y no 401, para que el frontend no cierre la sesión.

## Seguridad

- Solo se guarda el nuevo hash bcrypt; la respuesta nunca incluye contraseñas ni hash.
- Los intentos fallidos de contraseña actual se cuentan por cuenta con el mismo mecanismo y los mismos límites del inicio de sesión (`LOGIN_MAX_ATTEMPTS`), pero con su propia clave: un token robado no sirve para adivinar la contraseña y el bloqueo no impide iniciar sesión. El conteo vive en memoria del proceso, como el del inicio de sesión.
- La sesión abierta (y otras) sigue valiendo después del cambio: el sistema no guarda sesiones en el servidor. La nueva contraseña rige desde el siguiente inicio de sesión.

## Pruebas

`backend/tests/integration/auth-password.test.js`, contra la base `gymaccess_test`.
