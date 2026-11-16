# GymAccess

Sistema web para el Gimnasio Vida Fitness: administra clientes, membresías, pagos, entrenadores y
rutinas, y controla la entrada con **reconocimiento facial**. La puerta solo se abre a clientes con
su membresía vigente y pagada, y cada intento queda registrado. Proyecto académico de Gestión de
Proyectos (TecNM Campus Huauchinango), desarrollado con Spec Kit (desarrollo guiado por
especificaciones) y Claude Code.

**Estado:** Sprints 1, 2 y 3 terminados. 546 pruebas del backend y 433 del frontend en verde.

## Qué hace

| Módulo | Qué incluye |
|--------|-------------|
| Acceso y roles | Inicio de sesión (JWT, 8 h), bloqueo tras 5 intentos fallidos, menú e inicio distintos por rol |
| Usuarios y clientes | Altas, consulta, edición y bajas lógicas (nada se elimina) |
| Membresías y pagos | Tipos de membresía, asignación y renovación, pago completo, pagos y adeudos |
| Reconocimiento facial | Registro del rostro con la cámara; solo se guarda un descriptor de 128 números cifrado con AES-256-GCM, nunca fotos |
| Estación de acceso | Modo Entrada y Salida; autoriza solo con rostro reconocido y membresía vigente y pagada; pausa tras 3 rechazos |
| Accesos y auditoría | Historial de entradas y salidas con su motivo; registro de las acciones importantes |
| Dashboard y avisos | Ingresos, accesos y entrenamiento; campana con membresías por vencer y vencidas |
| Entrenamiento | Entrenadores, asignación de clientes, rutinas versionadas, objetivos y progreso; vista "Mi entrenamiento" del cliente |
| Respaldo | Respaldo diario automático de la base (`npm run respaldo`), se guardan los últimos 7 |

### Qué puede hacer cada rol

| Rol | Puede |
|-----|-------|
| Administrador | Todo: usuarios, clientes, membresías, pagos, accesos, dashboard, auditoría y entrenadores |
| Recepcionista | Registrar clientes, asignar membresías, cobrar, registrar rostros y consultar pagos, adeudos y accesos |
| Entrenador | Ver solo a sus clientes asignados y gestionar sus rutinas, objetivos y progreso |
| Cliente | Ver únicamente su membresía, pagos, accesos, avisos y su entrenamiento |

Los permisos se validan siempre en el backend.

## Tecnologías

```text
frontend/   React 18 + Vite, React Router, @vladmandic/face-api (reconocimiento en el navegador)
backend/    Node.js 24 + Express 5 (ES Modules), mysql2, JWT, bcryptjs, zod
database/   MySQL local (InnoDB, utf8mb4): migraciones, semillas y scripts
docs/       Constitución, contexto del proyecto, sprints y guía de respaldo
specs/      Especificaciones de Spec Kit (spec, plan, data-model, tasks) de cada funcionalidad
```

## Requisitos

- Node.js 24 y npm
- MySQL local con la base `gymaccess` y el usuario `gymaccess_app` (permisos `SELECT`, `INSERT` y
  `UPDATE`; sin `DELETE`)

> No ejecutes `database/migrations/01_esquema_sprint1.sql` sobre la base existente: contiene
> `DROP DATABASE`. Las migraciones `02_esquema_sprint2.sql` y `03_esquema_sprint3.sql` agregan las
> tablas de los sprints siguientes (14 tablas en total). Más detalles en [database/README.md](database/README.md).

## Puesta en marcha

1. **Entorno.** Copia `backend/.env.example` como `backend/.env` y completa los valores, entre ellos
   `DB_PASSWORD`, `JWT_SECRET` y `FACE_KEY` (64 caracteres hexadecimales). Para generar un secreto:
   `node -p "crypto.randomBytes(32).toString('hex')"`. El archivo `.env` nunca se sube al repositorio.
2. **Dependencias.** `npm install` dentro de `backend/` y de `frontend/`.
3. **Administrador inicial** (una sola vez). Define `ADMIN_EMAIL`, `ADMIN_NOMBRE` y `ADMIN_PASSWORD`
   en `backend/.env` y, desde la raíz del proyecto, ejecuta:
   `node --env-file=backend/.env database/scripts/crear-admin.js`. Después borra la contraseña del `.env`.
4. **Backend:** `npm run dev` en `backend/` (puerto 3000).
5. **Frontend:** `npm run dev` en `frontend/` (puerto 5173) y abre `http://localhost:5173`.

La cámara de la estación de acceso funciona en `localhost`; en un servidor real necesita HTTPS.

## Pruebas

Las pruebas automáticas usan **siempre** una base separada, `gymaccess_test`, nunca `gymaccess`.

1. Ejecuta una vez, como `root`: `mysql -u root -p -e "source database/scripts/crear-bd-pruebas.sql"`.
2. Copia `backend/.env.test.example` como `backend/.env.test` y completa sus valores.
3. `npm test` dentro de `backend/` (`node --test`) y dentro de `frontend/` (`vitest`).

Si `DB_NAME` no termina en `_test`, las pruebas de integración se niegan a ejecutarse.

## Respaldo

`npm run respaldo` en `backend/` crea `gymaccess_AAAA-MM-DD_HHMM.sql` en `RESPALDO_DIR` con un usuario
de MySQL de solo lectura y conserva los últimos 7. Cómo programarlo a las 23:00 en Windows y cómo
restaurarlo: [docs/respaldo.md](docs/respaldo.md).

## Documentación

| Qué | Dónde |
|-----|-------|
| Constitución (11 principios) | [.specify/memory/constitution.md](.specify/memory/constitution.md) |
| Contexto del proyecto | [docs/project-context.md](docs/project-context.md) |
| Sprint 1: usuarios y clientes | [specs/001-base-usuarios-clientes/](specs/001-base-usuarios-clientes/) |
| Rediseño de interfaz | [specs/002-interfaz-menu-lateral/](specs/002-interfaz-menu-lateral/) |
| Sprint 2 (MVP): membresías, pagos y acceso | [specs/003-membresias-pagos-acceso/](specs/003-membresias-pagos-acceso/) |
| Sprint 3: entrenadores y rutinas | [specs/004-entrenadores-rutinas/](specs/004-entrenadores-rutinas/) |
| Bitácora de avance | [docs/estado.md](docs/estado.md) |
| Instrucciones para la IA | [CLAUDE.md](CLAUDE.md) |

## Seguridad

- Las contraseñas se guardan con bcrypt y nunca se devuelven en una respuesta.
- Los datos faciales se guardan cifrados y nunca salen en las respuestas ni en los registros.
- Los permisos se validan siempre en el backend; ocultar una opción en la interfaz no es seguridad.
- Todas las consultas SQL son parametrizadas y el backend se conecta con un usuario sin `DELETE`.
- Los secretos viven solo en variables de entorno (`.env` y `.env.test` están ignorados por git).

## Limitaciones conocidas

- La estación no distingue un rostro real de una fotografía (sin detección de vida).
- No se integró el relevador para abrir una chapa magnética o un torniquete: la estación muestra el
  resultado, pero no acciona una cerradura.
