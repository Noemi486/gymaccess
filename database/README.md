# Base de datos GymAccess

Base de datos `gymaccess` en MySQL local (InnoDB, `utf8mb4`).

## Esquema oficial

| Script | Contenido |
|--------|-----------|
| `migrations/01_esquema_sprint1.sql` | `usuarios`, `clientes`, `tipos_membresia`, `membresias`, `pagos` |
| `migrations/02_esquema_sprint2.sql` | `rostros`, `accesos`, `auditoria` |

La base **ya existe** con sus 8 tablas. Los scripts no se modifican; cualquier cambio de
estructura se agrega como un script nuevo y numerado.

## ⚠️ Advertencia

`01_esquema_sprint1.sql` empieza con `DROP DATABASE IF EXISTS gymaccess`.
**No lo ejecutes sobre la base existente**: borraría todos los datos. Solo sirve para
reconstruir una base vacía desde cero.

## Usuario de la aplicación

El backend se conecta con `gymaccess_app`, que solo tiene permisos `SELECT`, `INSERT` y
`UPDATE` (sin `DELETE`). Por eso las bajas son lógicas (campo `estado`) y los registros
históricos no se eliminan. Nunca se usa `root` desde la aplicación.

Los scripts que contienen contraseñas (creación del usuario de la base de datos) se guardan
**fuera del repositorio**.

## Base de datos de pruebas (`gymaccess_test`)

Las pruebas automáticas **nunca** usan `gymaccess`: trabajan sobre `gymaccess_test`, una base
separada con las mismas 8 tablas.

1. Ejecuta **como `root`** el script `scripts/crear-bd-pruebas.sql`:
   `mysql -u root -p -e "source database/scripts/crear-bd-pruebas.sql"` (desde la raíz del proyecto)
   o ábrelo en MySQL Workbench y ejecútalo completo.
2. El script crea `gymaccess_test` (con `IF NOT EXISTS`, sin borrar nada), copia el DDL oficial y
   concede a `gymaccess_app` SELECT, INSERT, UPDATE y DELETE **solo sobre `gymaccess_test`**.
   No toca `gymaccess` ni los permisos que `gymaccess_app` tiene sobre ella.
3. Copia `backend/.env.test.example` como `backend/.env.test` y completa `DB_PASSWORD`.
4. `npm test` (en `backend/`) carga `.env.test`; si `DB_NAME` no termina en `_test`, las pruebas
   de integración se niegan a ejecutarse.

Si cambia el esquema oficial, actualiza también `crear-bd-pruebas.sql`.

## Administrador inicial

`scripts/crear-admin.js` crea la primera cuenta de administrador. Lee `ADMIN_EMAIL`,
`ADMIN_NOMBRE` y `ADMIN_PASSWORD` del entorno, se conecta con `gymaccess_app` (solo hace un
`INSERT`), no imprime la contraseña y es idempotente: si el correo ya existe, no cambia nada.

```text
node --env-file=backend/.env database/scripts/crear-admin.js
```

Ejecútalo desde la raíz del proyecto. La contraseña debe tener entre 8 y 72 caracteres, con al
menos una letra y un número. Bórrala del `.env` cuando termines.

## Carpetas

- `migrations/`: scripts SQL versionados del esquema.
- `seeds/`: datos iniciales (por ahora vacía: el administrador inicial se crea con `crear-admin.js`).
- `scripts/`: `crear-admin.js` (ES Module) y `crear-bd-pruebas.sql` (base de pruebas).
