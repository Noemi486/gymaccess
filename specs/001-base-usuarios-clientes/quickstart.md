# Guía de validación (quickstart): Sprint 1

**Feature**: `001-base-usuarios-clientes` | Contrato: [contracts/api.openapi.yaml](contracts/api.openapi.yaml) | Datos: [data-model.md](data-model.md)

Sirve para comprobar de extremo a extremo que el sprint funciona. No contiene código de implementación.

## Prerrequisitos

- Node.js 24 y npm.
- MySQL local con la base `gymaccess` **ya creada** (8 tablas) y el usuario `gymaccess_app`.
- **No ejecutes** `database/migrations/01_esquema_sprint1.sql`: empieza con `DROP DATABASE` y borraría los datos.
- Un archivo `backend/.env` creado a partir de `backend/.env.example` con:
  `DB_HOST`, `DB_PORT`, `DB_USER=gymaccess_app`, `DB_PASSWORD`, `DB_NAME=gymaccess`,
  `JWT_SECRET`, `JWT_EXPIRES_IN=8h`, `PORT=3000`, `CORS_ORIGIN=http://localhost:5173`,
  `LOGIN_MAX_ATTEMPTS=5`, `LOGIN_LOCK_MINUTES=15`.
- El archivo `.env` está en `.gitignore`; nunca se sube.

## Preparación

1. Instalar dependencias en `backend/` y en `frontend/` (`npm install`).
2. Crear el administrador inicial (una sola vez; idempotente). Define `ADMIN_EMAIL`, `ADMIN_NOMBRE` y `ADMIN_PASSWORD` en tu terminal (no en el repositorio) y ejecuta el script `database/scripts/crear-admin.js`.
3. Levantar el backend (`npm run dev` en `backend/`) y el frontend (`npm run dev` en `frontend/`).

## Escenarios de validación

| # | Escenario | Resultado esperado | Requisitos |
|---|-----------|--------------------|------------|
| 1 | Iniciar sesión como administrador con credenciales válidas | 200, token y rol `administrador` | FR-001, FR-004 |
| 2 | Iniciar sesión con contraseña errónea y con correo inexistente | 401 con el mismo mensaje genérico en ambos casos | FR-002 |
| 3 | Repetir 5 inicios fallidos seguidos y probar con la contraseña correcta | 423 durante 15 minutos; después permite entrar | FR-003a |
| 4 | Llamar a `/api/clientes` sin token y con un token alterado | 401 en ambos | FR-005, SC-003 |
| 5 | Como administrador, crear un usuario `recepcionista` y otro `entrenador` | 201; la respuesta no incluye contraseña | FR-008, FR-007 |
| 6 | Crear un usuario con correo repetido; con contraseña de 7 caracteres; con contraseña sin números | 409; 400; 400 con el campo indicado | FR-010, FR-007a |
| 7 | Como recepcionista, intentar `GET /api/usuarios` | 403 | FR-008, SC-002 |
| 8 | Como recepcionista, registrar un cliente con nombre, apellido y teléfono | 201 | FR-015 |
| 9 | Registrar un cliente sin teléfono; con correo repetido; con correo vacío (dos veces) | 400 con el campo; 409; ambos 201 con correo `null` | FR-017, FR-018 |
| 10 | Como recepcionista, modificar el teléfono de un cliente | 200 con el dato nuevo | FR-016 |
| 11 | Como recepcionista, intentar dar de baja a un cliente | 403 | FR-021 |
| 12 | Como administrador, dar de baja y reactivar al cliente | 200 en ambos; el registro sigue existiendo | FR-021 |
| 13 | Como entrenador, listar y consultar clientes | Solo `id_cliente`, nombre, apellido, estado y fecha de registro | FR-019 |
| 14 | Como entrenador, intentar crear o modificar un cliente | 403 | FR-015, FR-016 |
| 15 | Como administrador, crear una cuenta `cliente` ligada a un cliente con correo | 201; la cuenta usa el correo del cliente | FR-011 |
| 16 | Crear una cuenta `cliente` para un cliente sin correo | 409 | FR-011 |
| 17 | Como cliente, `GET /api/clientes/me` y luego `GET /api/clientes/{otro id}` | 200 con sus datos; 403 en el segundo | FR-020, SC-008 |
| 18 | Desactivar al único administrador activo | 409 | FR-012 |
| 19 | Desactivar a un usuario con sesión abierta y repetir una petición con su token | 401 inmediato | FR-003, FR-006 |
| 20 | Provocar un error interno (p. ej. detener MySQL) y llamar a la API | 500 con mensaje genérico, sin detalles técnicos | FR-023, SC-007 |
| 21 | Recorrer el flujo completo en el navegador: login → alta de cliente (recepcionista) → consulta (entrenador) → consulta propia (cliente), reiniciar el backend y volver a consultar | Los datos siguen ahí | SC-009 |
| 22 | Revisar el repositorio | No hay `.env`, contraseñas ni secretos; existen `.env.example` | SC-010 |
| 23 | Dar de baja a un cliente que tiene cuenta, intentar iniciar sesión y usar su sesión abierta; luego reactivarlo | 401 genérico (igual que una contraseña errónea) en ambos casos; al reactivarlo la misma cuenta vuelve a entrar | FR-003b, SC-011 |

## Pruebas automáticas

- `backend/`: `npm test` (ejecutor integrado de Node). Usa **solo la base `gymaccess_test`**, nunca `gymaccess`: requiere haber ejecutado antes `database/scripts/crear-bd-pruebas.sql` como `root` y tener `backend/.env.test` (plantilla: `backend/.env.test.example`). Las pruebas de integración crean datos con correos únicos de prefijo `test+` y dejan esas cuentas inactivas.
- `frontend/`: `npm test` (inicio de sesión y protección de rutas por rol).

## Dónde se ejecuta esta validación

La validación de cierre se hace **siempre contra la base de pruebas `gymaccess_test`**, nunca contra
`gymaccess`: se levanta una instancia del backend con `backend/.env.test` (puerto 3001) y el
administrador inicial se crea con `database/scripts/crear-admin.js` apuntando a ese mismo entorno.
Para repetirla basta con usar `--env-file=backend/.env.test` en lugar de `backend/.env`.

### Resultado de la última corrida (cierre del Sprint 1)

| Escenarios | Resultado |
|------------|-----------|
| 1 a 19, 21 y 23 | ✔ Correctos contra el servidor real |
| 3 (desbloqueo) | ✔ Comprobado esperando el vencimiento real del bloqueo, configurado en 1 minuto para la prueba (el valor de 15 minutos se verifica con un reloj simulado en las pruebas unitarias) |
| 18 | ✔ Con `gymaccess_test` sin otros administradores activos (condición necesaria para la regla) |
| 20 | ✔ Simulado con una segunda instancia del backend apuntando a un puerto de MySQL inexistente, sin detener el MySQL real: respuesta 500 genérica, sin rastro de la conexión ni de la pila |
| 21 | ✔ Flujo completo por API con **reinicio real del backend** entre la parte A y la B; los datos persisten. La parte del flujo hecha "en el navegador" no se ejecutó con un navegador real: está cubierta por las pruebas de componentes del frontend |
| 22 | ✔ 0 coincidencias de los secretos reales en los 127 archivos de texto del repositorio; `.env` y `.env.test` ignorados; plantillas sin secretos |

## Criterio de cierre

Todos los escenarios anteriores pasan, las pruebas automáticas están en verde y la lista de comprobación de "funcionalidad terminada" de la constitución (Flujo de Desarrollo) se cumple.
