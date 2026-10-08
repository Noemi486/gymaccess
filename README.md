# GymAccess

Sistema web de gestión para gimnasio: clientes, membresías, pagos y control de acceso con
reconocimiento facial. Proyecto académico.

**Estado:** Sprint 1 completo (autenticación, usuarios, roles y clientes). Membresías, pagos,
reconocimiento facial, control de acceso, dashboard, reportes y auditoría llegan en el Sprint 2.

## Qué hace hoy

- Inicio de sesión con correo y contraseña (JWT, 8 h) y bloqueo temporal de 15 minutos tras
  5 intentos fallidos.
- Cuatro roles con permisos validados siempre en el backend:

  | Rol | Puede |
  |-----|-------|
  | Administrador | Gestionar usuarios y roles; registrar, modificar, consultar y dar de baja clientes |
  | Recepcionista | Registrar, modificar y consultar clientes |
  | Entrenador | Consultar clientes (solo nombre, apellido, estado y fecha de registro) |
  | Cliente | Consultar únicamente su propia información |

- Las bajas son lógicas: nada se elimina. Un cliente dado de baja no puede iniciar sesión.

## Estructura

```text
frontend/   Interfaz web (React + JavaScript, Vite)
backend/    API REST (Node.js 24 + Express, ES Modules)
database/   Esquema SQL, semillas y scripts de MySQL
docs/       Constitución, contexto y sprints
specs/      Especificación, plan, contrato de la API y tareas (Spec Kit)
```

## Requisitos

- Node.js 24 y npm
- MySQL local con la base `gymaccess` ya creada y el usuario `gymaccess_app`
  (permisos `SELECT`, `INSERT` y `UPDATE`; sin `DELETE`)

> No ejecutes `database/migrations/01_esquema_sprint1.sql` sobre la base existente: contiene
> `DROP DATABASE`. Más detalles en [database/README.md](database/README.md).

## Puesta en marcha

1. **Entorno.** Copia `backend/.env.example` como `backend/.env` y completa `DB_PASSWORD` y
   `JWT_SECRET`. Para generar el secreto:
   `node -p "crypto.randomBytes(48).toString('hex')"`. El archivo `.env` nunca se sube al repositorio.
2. **Dependencias.** `npm install` dentro de `backend/` y de `frontend/`.
3. **Administrador inicial** (una sola vez; es idempotente). Define `ADMIN_EMAIL`, `ADMIN_NOMBRE` y
   `ADMIN_PASSWORD` en `backend/.env` (o en tu terminal) y, desde la raíz del proyecto, ejecuta:
   `node --env-file=backend/.env database/scripts/crear-admin.js`.
   La contraseña debe tener entre 8 y 72 caracteres, con al menos una letra y un número; bórrala
   del `.env` cuando termines.
4. **Backend:** `npm run dev` en `backend/` (puerto 3000).
5. **Frontend:** `npm run dev` en `frontend/` (puerto 5173) y abre `http://localhost:5173`.

## Pruebas

Las pruebas automáticas usan **siempre** una base separada, `gymaccess_test`, nunca `gymaccess`.

1. Ejecuta una vez, como `root`: `mysql -u root -p -e "source database/scripts/crear-bd-pruebas.sql"`
   (o ábrelo en MySQL Workbench).
2. Copia `backend/.env.test.example` como `backend/.env.test` y completa `DB_PASSWORD` y `JWT_SECRET`.
3. `npm test` dentro de `backend/` (unitarias y de integración con `node --test`) y dentro de
   `frontend/` (`vitest`).

Si `DB_NAME` no termina en `_test`, las pruebas de integración se niegan a ejecutarse.

## Documentación

- Especificación y decisiones: [specs/001-base-usuarios-clientes/](specs/001-base-usuarios-clientes/)
  (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `tasks.md`).
- Contrato de la API (OpenAPI):
  [specs/001-base-usuarios-clientes/contracts/api.openapi.yaml](specs/001-base-usuarios-clientes/contracts/api.openapi.yaml).
- Guía de validación de extremo a extremo:
  [specs/001-base-usuarios-clientes/quickstart.md](specs/001-base-usuarios-clientes/quickstart.md).

## Seguridad

- Las contraseñas se guardan con bcrypt y nunca se devuelven en una respuesta.
- Los permisos se validan siempre en el backend; ocultar una opción en la interfaz no es seguridad.
- Todas las consultas SQL son parametrizadas y el backend se conecta con un usuario sin `DELETE`.
- Los errores que ve el usuario nunca incluyen detalles internos del servidor.
- Los secretos viven solo en variables de entorno (`.env` y `.env.test` están ignorados por git).
