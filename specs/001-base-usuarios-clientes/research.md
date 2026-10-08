# Investigación (Fase 0): Base del sistema, usuarios y clientes

**Feature**: `001-base-usuarios-clientes` | **Fecha**: 2026-10-07

Las decisiones marcadas como **[Requiere aprobación]** son "Decisiones Pendientes" de la
constitución (v1.1.1); esta propuesta debe ser aprobada por el equipo antes de considerarse
definitiva.

## Hallazgos sobre el esquema oficial (`database/migrations/01` y `02`)

El esquema ya cubre buena parte de las reglas de la spec; el backend no debe duplicarlas
con lógica distinta, pero sí debe validarlas antes para dar mensajes claros.

| Regla de la spec | Cómo la cubre el esquema | Qué debe hacer el backend |
|------------------|--------------------------|---------------------------|
| FR-010 correo de usuario único | `uq_usuarios_correo` | Normalizar (trim + minúsculas) y traducir el error 1062 a 409 |
| FR-017 correo de cliente opcional y único | `correo NULL` + `uq_clientes_correo` | Convertir `""` o espacios a `NULL` (un `''` sí chocaría con el UNIQUE) |
| FR-015 nombre, apellido y teléfono obligatorios | `NOT NULL` + `CHECK(CHAR_LENGTH(TRIM(...)) > 0)` | Validar antes para mostrar qué campo falta |
| FR-011 rol cliente ligado a un cliente | `ck_usuarios_rol_cliente` + `uq_usuarios_cliente` (una cuenta por cliente) | Además exigir que el cliente tenga correo y que la cuenta use ese correo (el esquema no lo impone) |
| FR-007 hash de contraseña | `password VARCHAR(100)` (un hash bcrypt mide 60) | Guardar solo el hash |
| FR-013, FR-021 bajas lógicas | `estado ENUM('activo','inactivo')`; `gymaccess_app` sin DELETE | No exponer ninguna operación de borrado |
| Coincidencia de correos sin distinguir mayúsculas | Intercalación `utf8mb4_0900_ai_ci` (insensible a mayúsculas y acentos) | Normalizar a minúsculas igualmente |

**Lo que el esquema NO cubre** (y no se modifica):

- **Bloqueo por intentos fallidos (FR-003a)**: no hay columnas para guardarlo.
- **Último administrador activo (FR-012)**: solo se puede garantizar desde el backend.
- **Fecha de última modificación**: no existe; no se requiere.

**Advertencia operativa**: el script `01_esquema_sprint1.sql` empieza con
`DROP DATABASE IF EXISTS gymaccess`. Como la base ya existe y tiene datos, **nunca debe
ejecutarse de nuevo** salvo para reconstruir una base vacía. Ni las tareas ni los scripts de
prueba lo invocan.

## Decisiones técnicas

### D1. Driver de base de datos: `mysql2` con consultas parametrizadas, sin ORM

- **Decisión**: `mysql2/promise` con un pool de conexiones y consultas con `?`. Sin ORM ni query builder.
- **Justificación**: son 2 tablas con SQL simple; el esquema ya está definido y no debe cambiar (un ORM con sincronización sería un riesgo). Cumple "consultas parametrizadas" (Principio III) y "no agregar dependencias innecesarias".
- **Alternativas**: Sequelize/Prisma (rechazadas: dependencia pesada y riesgo de tocar el esquema); `mysql` (abandonado, sin promesas).

### D2. Hash de contraseñas: `bcryptjs`

- **Decisión**: `bcryptjs`, costo 10. Contraseña máxima de 72 caracteres.
- **Justificación**: implementa bcrypt sin compilación nativa, lo que evita fallos de instalación en Windows. bcrypt solo considera los primeros 72 bytes, por eso se limita la longitud.
- **Alternativas**: `bcrypt` (nativo; más rápido pero requiere binarios), `argon2` (la constitución pide bcrypt).

### D3. Autenticación: JWT HS256 enviado en `Authorization: Bearer`

- **Decisión**: `jsonwebtoken`, expiración de 8 horas (supuesto de la spec), secreto en `JWT_SECRET`. El token lleva solo `sub` (id_usuario). El frontend lo guarda en `sessionStorage`.
- **Justificación**: la constitución exige JWT. En cada petición protegida el middleware **vuelve a leer** de la base de datos el estado y el rol del usuario, de modo que desactivar una cuenta o cambiar su rol surte efecto de inmediato (más estricto que "en su siguiente inicio de sesión") y los permisos nunca se confían al token.
- **Alternativas**: cookie httpOnly (requiere defensa contra CSRF; excesivo aquí); guardar el rol en el token (permite que un rol revocado siga vigente hasta expirar).
- **Riesgo aceptado**: `sessionStorage` es accesible si hubiera XSS; se mitiga porque React escapa el contenido y no se usa HTML inyectado.

### D4. Bloqueo por intentos fallidos (FR-003a) sin cambiar el esquema

- **Decisión**: contador en memoria del proceso (`Map` por correo normalizado): 5 fallos seguidos → bloqueo de 15 minutos; un inicio de sesión exitoso reinicia el contador. Los valores salen de `LOGIN_MAX_ATTEMPTS` y `LOGIN_LOCK_MINUTES`. Se cuenta también para correos que no existen, para no revelar si existen.
- **Justificación**: el esquema oficial no tiene dónde guardar intentos y no puede cambiarse.
- **Limitación documentada**: el bloqueo se pierde al reiniciar el servidor y no se comparte entre varias instancias. Es aceptable para un MVP académico con un solo proceso.
- **Alternativas**: nueva tabla o columnas (prohibido por la instrucción), paquete `express-rate-limit` (limita por IP, no por cuenta).

### D5. Validación: `zod` en `validators/`

- **Decisión**: esquemas `zod` para cada cuerpo de petición y parámetros de consulta; middleware único `validate(schema)`.
- **Justificación**: mensajes de error por campo (FR-018) con poco código y una sola fuente de reglas.
- **Alternativas**: `joi`, `express-validator` (equivalentes; zod es más ligero); validación manual (más código y más errores).

### D6. Pruebas

- **Backend**: ejecutor integrado `node --test` (sin dependencias). Pruebas unitarias de servicios y middlewares con modelos simulados; pruebas de integración de la API con `fetch` contra una instancia levantada en un puerto aleatorio.
- **Base de pruebas separada** (decisión posterior, a petición del equipo): las pruebas usan SIEMPRE `gymaccess_test`, nunca `gymaccess`. La crea `database/scripts/crear-bd-pruebas.sql` (se ejecuta como `root`; copia el DDL oficial de las 8 tablas, no toca `gymaccess` y concede a `gymaccess_app` SELECT, INSERT, UPDATE y DELETE solo sobre `gymaccess_test`). `npm test` carga `backend/.env.test`, y `tests/helpers.js` se niega a funcionar si `DB_NAME` no termina en `_test`.
- **Datos de prueba**: correos únicos con prefijo `test+<marca de tiempo>`; las cuentas se dejan inactivas al terminar.
- **Frontend**: `vitest` + `@testing-library/react` para el inicio de sesión y la protección de rutas por rol.
- **[Requiere aprobación]**: herramienta de pruebas.

### D7. Frontend

- **Decisión**: React 18 + Vite + `react-router-dom`; estado de sesión con Context de React (sin Redux); `fetch` propio en un cliente `api`; estilos con CSS propio (sin biblioteca de componentes); formularios controlados mostrando los errores por campo que devuelve la API.
- **Justificación**: la app tiene ~6 pantallas; las bibliotecas adicionales no se justifican.
- **[Requiere aprobación]**: manejo de estado, biblioteca de componentes y validación de formularios.

### D8. Dependencias de configuración

- **Decisión**: variables de entorno cargadas con `node --env-file` (Node 24), sin `dotenv`. `cors` limitado al origen del frontend (`CORS_ORIGIN`). No se agrega `helmet`.
- **Justificación**: menos dependencias (Principio III). Revisable si el equipo lo pide.

### D9. Estructura de la API REST **[Requiere aprobación]**

- Prefijo `/api`; recursos en plural y en español como las tablas: `/api/auth`, `/api/usuarios`, `/api/clientes`.
- Errores con forma única: `{ "error": { "code", "message", "details?" } }`.
- Paginación por `page` y `limit` (por defecto 20, máximo 100) en las listas, más búsqueda `q` por nombre, apellido o correo (esto resuelve el punto de paginación y búsqueda aplazado en `/speckit-clarify`).
- Códigos: 200, 201, 400 (validación), 401 (sin sesión o credenciales), 403 (sin permiso), 404, 409 (duplicado o regla de negocio), 423 (cuenta bloqueada temporalmente), 500 (genérico).

### D10. Reglas que la spec no definía y que este plan fija

| Tema | Decisión | Motivo |
|------|----------|--------|
| Cambiar o quitar el correo de un cliente que ya tiene cuenta | Se rechaza con 409 mientras exista la cuenta | Mantener la regla "la cuenta usa el correo del cliente" sin sincronizaciones silenciosas |
| Cliente dado de baja con cuenta activa | **Decisión del equipo (posterior):** la cuenta no puede iniciar sesión ni usar una sesión abierta mientras el cliente esté inactivo; al reactivarlo recupera el acceso. Se resuelve con un `LEFT JOIN` a `clientes` al leer el usuario (`estado_cliente`), sin cambiar el esquema | Un cliente dado de baja no debe entrar al sistema (FR-003b); el mismo 401 genérico evita revelar el estado |
| Cambio de contraseña por el administrador | Permitido en la modificación de usuario, con la misma política (FR-007a) | "Modificar usuarios" (FR-008) sin crear un flujo de recuperación (excluido) |
| Mensaje de cuenta desactivada | Mismo mensaje genérico que credenciales inválidas | No revelar si el correo existe (FR-002) |
| Administrador inicial | Script `database/scripts/crear-admin.js` lee `ADMIN_EMAIL`, `ADMIN_NOMBRE` y `ADMIN_PASSWORD` del entorno y hace un `INSERT` si no existe (idempotente) | `gymaccess_app` tiene INSERT; la contraseña nunca entra al repositorio (FR-025) |
| Último administrador | Operación dentro de una transacción con `SELECT ... FOR UPDATE` sobre los administradores activos | Evitar carreras entre dos desactivaciones simultáneas |

## Pendientes que no bloquean este sprint

- Zona horaria de las fechas: se usará la del servidor y se devolverán en ISO 8601; se revisa en el Sprint 2 con los accesos.
- Despliegue y hosting: fuera del alcance del MVP del Sprint 1.
