---

description: "Lista de tareas del Sprint 1: base del sistema, usuarios y clientes"
---

# Tasks: Base del sistema, usuarios y clientes (Sprint 1)

**Input**: Documentos de diseño en `/specs/001-base-usuarios-clientes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.openapi.yaml, quickstart.md

**Tests**: Se incluyen porque la constitución (Principio X) exige probar las funciones principales y el plan define las herramientas (`node --test` en el backend, `vitest` en el frontend).

**Organization**: Las tareas se agrupan por historia de usuario para poder implementar y probar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1..US5)
- Todas las rutas son relativas a la raíz del repositorio `gym-system/`

## Reglas transversales (aplican a todas las tareas)

- **NO modificar el esquema** de `gymaccess` ni crear tablas. **NO ejecutar** `database/migrations/01_esquema_sprint1.sql` (contiene `DROP DATABASE`). El backend usa `gymaccess_app` (solo `SELECT`, `INSERT`, `UPDATE`): **ninguna sentencia `DELETE`** en el código.
- Todo el JavaScript del backend y de `database/scripts/` usa ES Modules (`import`/`export`); prohibido `require()` y `module.exports`.
- Todas las consultas SQL son parametrizadas (`?`); nunca se concatenan valores en el SQL.
- Los comentarios del código y los mensajes al usuario van en español.
- Nunca poner contraseñas ni secretos en el repositorio; usar variables de entorno.
- Las pruebas automáticas usan **solo la base `gymaccess_test`** (`backend/.env.test`, creada con `database/scripts/crear-bd-pruebas.sql`); nunca `gymaccess`. `tests/helpers.js` rechaza cualquier `DB_NAME` que no termine en `_test`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estructura inicial del proyecto según plan.md

- [X] T001 Crear la estructura de carpetas de plan.md: `backend/src/{config,routes,controllers,services,models,middlewares,validators,utils}/`, `backend/tests/{unit,integration}/`, `frontend/src/{api,context,pages,components,styles}/`, `frontend/tests/`, `database/{seeds,scripts}/` (sin crear carpetas alternativas como `client/`, `server/` o `dataBase/`)
- [X] T002 Crear `backend/package.json` con `"type": "module"`, dependencias `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`, `cors`, y scripts `dev` (`node --env-file=.env --watch src/server.js`), `start` y `test` (`node --env-file=.env --test tests/`); instalar con `npm install` en `backend/`
- [X] T003 [P] Crear `frontend/package.json`, `frontend/index.html` y `frontend/vite.config.js` (React 18, `react-router-dom`, `vite`, `vitest`, `@testing-library/react`, `jsdom`; proxy de `/api` hacia `http://localhost:3000`); instalar con `npm install` en `frontend/`
- [X] T004 [P] Crear `.gitignore` en la raíz (incluir `.env`, `node_modules/`, `dist/`), `.env.example` en la raíz y `backend/.env.example` con las variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `CORS_ORIGIN`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES` y `ADMIN_EMAIL`, `ADMIN_NOMBRE`, `ADMIN_PASSWORD`, todas sin valores reales
- [X] T005 [P] Crear `README.md` en la raíz (cómo instalar y ejecutar, enlace a `specs/001-base-usuarios-clientes/quickstart.md`) y `database/README.md` (indicar que el esquema oficial es `database/migrations/01_*.sql` y `02_*.sql`, que la base ya existe y que **no se debe ejecutar el script 01 sobre ella porque hace `DROP DATABASE`**)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura que TODAS las historias necesitan

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase

- [X] T006 Implementar `backend/src/config/env.js`: leer y validar las variables de entorno de `backend/.env.example` (fallar al arrancar si falta `JWT_SECRET` o `DB_*`); valores por defecto `PORT=3000`, `JWT_EXPIRES_IN=8h`, `LOGIN_MAX_ATTEMPTS=5`, `LOGIN_LOCK_MINUTES=15`
- [X] T007 [P] Implementar `backend/src/config/db.js`: pool de `mysql2/promise` con las variables `DB_*` (nunca `root`), y una función `conTransaccion(callback)` que abre conexión, ejecuta `BEGIN`, `COMMIT` o `ROLLBACK`
- [X] T008 [P] Implementar `backend/src/utils/errores.js`: clase `ErrorApp(status, code, message, details)` y constantes de códigos (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `ACCOUNT_LOCKED`, `INTERNAL_ERROR`)
- [X] T009 [P] Implementar `backend/src/utils/correo.js`: `normalizarCorreo(valor)` → recorta espacios y pasa a minúsculas; `""` o solo espacios devuelve `null`
- [X] T010 [P] Implementar `backend/src/utils/paginacion.js`: `leerPaginacion(query)` con `page` por defecto 1, `limit` por defecto 20 y máximo 100, y `offset` calculado
- [X] T011 [P] Implementar `backend/src/middlewares/validar.js`: `validar(esquemaZod, origen)` que valida `body`, `query` o `params` y responde 400 `VALIDATION_ERROR` con `details: [{ field, message }]` en español
- [X] T012 [P] Implementar `backend/src/middlewares/manejadorErrores.js`: manejador de 404 y manejador central de errores; `ErrorApp` se devuelve con su estado; el error MySQL 1062 (`ER_DUP_ENTRY`) se traduce a 409; cualquier otro error devuelve 500 con mensaje genérico y **sin** stack ni detalles internos; formato `{ "error": { "code", "message", "details?" } }`
- [X] T013 Implementar `backend/src/models/usuario.model.js` (solo lectura básica): `buscarPorCorreo(correo)` y `buscarPorId(id)` con SQL parametrizado sobre la tabla `usuarios`
- [X] T014 [P] Implementar `backend/src/models/cliente.model.js` (solo lectura básica): `buscarPorId(id)` con SQL parametrizado sobre la tabla `clientes`
- [X] T015 Implementar `backend/src/middlewares/autenticar.js`: leer `Authorization: Bearer`, verificar el JWT (HS256), **volver a leer el usuario en la base de datos** (T013) y responder 401 si el token es inválido o venció, o si el usuario no existe o `estado = 'inactivo'`; dejar `req.usuario` con `id_usuario`, `rol`, `id_cliente`, `estado`
- [X] T016 [P] Implementar `backend/src/middlewares/autorizar.js`: `autorizar(...roles)` que responde 403 `FORBIDDEN` cuando `req.usuario.rol` no está en la lista
- [X] T017 Implementar `backend/src/app.js` (Express con `express.json()`, `cors` limitado a `CORS_ORIGIN`, montaje de `routes/index.js` bajo `/api`, 404 y manejador central) y `backend/src/server.js` (escucha en `PORT`); crear `backend/src/routes/index.js` que monta los routers de cada historia a medida que existan
- [X] T018 [P] Crear los ayudantes de prueba en `backend/tests/helpers.js`: levantar `app` en un puerto aleatorio, `solicitar(metodo, ruta, { token, cuerpo })` con `fetch`, `crearToken(idUsuario)` firmado con `JWT_SECRET`, y generador de correos únicos `test+<marca de tiempo>-<n>@example.com`
- [X] T019 [P] Implementar `frontend/src/api/cliente.js`: `solicitar(ruta, opciones)` que agrega `Authorization: Bearer` desde `sessionStorage`, interpreta `{ error: { code, message, details } }` y lanza un error con el mensaje y los detalles por campo; ante 401 limpia la sesión y redirige a `/login`
- [X] T020 [P] Implementar componentes compartidos en `frontend/src/components/`: `Mensaje.jsx` (éxito o error visibles tras cada operación, FR-024), `Confirmacion.jsx` (diálogo de confirmación para bajas), `Paginacion.jsx` y `Layout.jsx` (encabezado con nombre y rol, botón "Cerrar sesión")
- [X] T021 [P] Crear `frontend/src/styles/estilos.css` (diseño sencillo y consistente, adaptable a pantallas pequeñas, insignias de estado `activo`/`inactivo`) y `frontend/src/main.jsx` que monta `App`

**Checkpoint**: Base lista; las historias pueden comenzar

---

## Phase 3: User Story 1 - Inicio de sesión con control por rol (Priority: P1) 🎯 MVP

**Goal**: Un usuario registrado inicia sesión con correo y contraseña; el sistema identifica su rol y protege las funciones por rol (FR-001..FR-007, FR-003a, FR-025).

**Independent Test**: Crear el administrador con el script de arranque, iniciar sesión con credenciales válidas e inválidas, comprobar el bloqueo tras 5 fallos y que una ruta protegida rechaza peticiones sin token o con token alterado.

### Tests for User Story 1 ⚠️

> Escribirlas primero y comprobar que FALLAN antes de implementar

- [X] T022 [P] [US1] Prueba unitaria de `intentos.service` en `backend/tests/unit/intentos.service.test.js`: 5 fallos seguidos bloquean 15 minutos; pasado el tiempo se desbloquea; un éxito reinicia el conteo; un correo inexistente también cuenta
- [X] T023 [P] [US1] Prueba unitaria de `auth.service` en `backend/tests/unit/auth.service.test.js` con modelo simulado: credenciales correctas devuelven token y usuario sin `password`; contraseña errónea, correo inexistente y cuenta `inactivo` devuelven el **mismo** error 401 genérico; cuenta bloqueada devuelve 423
- [X] T024 [P] [US1] Prueba unitaria de los middlewares `autenticar` y `autorizar` en `backend/tests/unit/middlewares.test.js`: sin token 401, token alterado 401, usuario inactivo 401, rol no permitido 403
- [X] T025 [P] [US1] Prueba de integración de `POST /api/auth/login` y `GET /api/auth/me` en `backend/tests/integration/auth.test.js` (escenarios 1 a 4 de quickstart.md); la respuesta nunca contiene `password`
- [X] T026 [P] [US1] Prueba del frontend en `frontend/tests/login.test.jsx`: el formulario de login muestra el error de credenciales y `RutaProtegida` redirige a `/login` sin sesión y bloquea un rol no permitido

### Implementation for User Story 1

- [X] T027 [P] [US1] Implementar `backend/src/validators/auth.validator.js`: esquema `zod` de login con `correo` (texto con formato de correo, se normaliza con `normalizarCorreo`) y `password` (texto obligatorio)
- [X] T028 [P] [US1] Implementar `backend/src/utils/serializadores.js`: `usuarioPublico(fila)` que devuelve `id_usuario, nombre, correo, rol, estado, id_cliente, fecha_registro` y **elimina siempre `password`**
- [X] T029 [US1] Implementar `backend/src/services/intentos.service.js` (depende de T006): `Map` en memoria por correo normalizado con `registrarFallo`, `registrarExito`, `estaBloqueado`; usa `LOGIN_MAX_ATTEMPTS` y `LOGIN_LOCK_MINUTES`; limpia entradas vencidas al consultar
- [X] T030 [US1] Implementar `backend/src/services/auth.service.js` (depende de T013, T028, T029): `iniciarSesion(correo, password)` con `bcryptjs.compare` (comparar contra un hash ficticio cuando el correo no existe para igualar tiempos), mismo error 401 genérico para correo inexistente, contraseña errónea y cuenta `inactivo`, error 423 si está bloqueada, firma del JWT (`sub = id_usuario`, expiración `JWT_EXPIRES_IN`); `obtenerSesion(usuario)`
- [X] T031 [US1] Implementar `backend/src/controllers/auth.controller.js` y `backend/src/routes/auth.routes.js`: `POST /api/auth/login` (con `validar`) y `GET /api/auth/me` (con `autenticar`); montarlo en `backend/src/routes/index.js`
- [X] T032 [P] [US1] Implementar `database/scripts/crear-admin.js` (ES Module): lee `ADMIN_EMAIL`, `ADMIN_NOMBRE` y `ADMIN_PASSWORD` del entorno, valida la política de contraseña (8 a 72 caracteres, al menos una letra y un número), genera el hash con `bcryptjs`, y hace `INSERT` del administrador solo si el correo no existe (idempotente); conecta con `gymaccess_app`; **nunca** imprime la contraseña
- [X] T033 [P] [US1] Implementar `frontend/src/context/AuthContext.jsx`: guarda `token` y `usuario` en `sessionStorage` (con `try/catch`), expone `iniciarSesion`, `cerrarSesion` y el rol
- [X] T034 [P] [US1] Implementar `frontend/src/components/RutaProtegida.jsx`: redirige a `/login` sin sesión y muestra "Sin permiso" si el rol no está permitido (la seguridad real sigue en el backend)
- [X] T035 [US1] Implementar `frontend/src/pages/Login.jsx` y `frontend/src/pages/Inicio.jsx`, y las rutas iniciales en `frontend/src/App.jsx` (depende de T033, T034, T019, T020): formulario de login con mensajes de error y de bloqueo temporal; pantalla de inicio que muestra solo los accesos del rol

**Checkpoint**: US1 funciona y se puede probar sola (MVP de seguridad)

---

## Phase 4: User Story 2 - Administración de usuarios y roles (Priority: P2)

**Goal**: El administrador registra, consulta, modifica, activa y desactiva usuarios y les asigna rol (FR-008..FR-014, FR-007a).

**Independent Test**: Como administrador crear un usuario recepcionista, cambiarle el rol, desactivarlo y comprobar que otro rol recibe 403; intentar dejar al sistema sin administradores activos y recibir 409.

### Tests for User Story 2 ⚠️

- [X] T036 [P] [US2] Prueba unitaria de `usuarios.service` en `backend/tests/unit/usuarios.service.test.js` con modelos simulados: política de contraseña, correo duplicado, no dejar al sistema sin administradores activos (desactivar o cambiar rol del último), rol `cliente` exige `id_cliente` de un cliente existente con correo y con el mismo correo, otros roles prohíben `id_cliente`, no se permite cambiar hacia o desde el rol `cliente`
- [X] T037 [P] [US2] Prueba de integración de `/api/usuarios` en `backend/tests/integration/usuarios.test.js` (escenarios 5, 6, 7, 18 y 19 de quickstart.md): alta, listado sin `password`, 409 por correo repetido, 400 por contraseña débil (7 caracteres y sin número), 403 para no administradores, y que un token de un usuario recién desactivado recibe 401
- [X] T038 [P] [US2] Prueba del frontend en `frontend/tests/usuarios.test.jsx`: el formulario de usuario muestra errores por campo y pide confirmación antes de desactivar

### Implementation for User Story 2

- [X] T039 [P] [US2] Implementar `backend/src/validators/usuario.validator.js` con `zod`, restricciones tal cual `data-model.md`: `nombre` obligatorio, recortado, máximo 120 (VARCHAR(120) NOT NULL); `correo` obligatorio, formato de correo, minúsculas, máximo 150 (VARCHAR(150) NOT NULL, UNIQUE); `password` de 8 a 72 caracteres con al menos una letra y un número; `rol` uno de `administrador|recepcionista|entrenador|cliente`; `estado` uno de `activo|inactivo`; `id_cliente` entero positivo, obligatorio si `rol = cliente` y prohibido en los demás roles; esquema de actualización con `minProperties: 1` y sin campos desconocidos
- [X] T040 [US2] Extender `backend/src/models/usuario.model.js` (depende de T013): `listar({ rol, estado, limit, offset })` con total, `crear(datos)`, `actualizar(id, campos)`, `contarAdministradoresActivos(conexion)` con `SELECT ... FOR UPDATE`, `buscarPorIdCliente(id_cliente)`; solo `SELECT`, `INSERT` y `UPDATE`
- [X] T041 [US2] Implementar `backend/src/services/usuarios.service.js` (depende de T040, T014, T028): `listar`, `obtener`, `crear` (hash `bcryptjs` costo 10, validar cliente para rol `cliente`, traducir duplicado a 409) y `actualizar` dentro de `conTransaccion` aplicando la regla del último administrador activo (409), la prohibición de cambiar hacia o desde el rol `cliente` (409) y el cambio opcional de contraseña con la misma política
- [X] T042 [US2] Implementar `backend/src/controllers/usuarios.controller.js` y `backend/src/routes/usuarios.routes.js`: `GET /api/usuarios`, `POST /api/usuarios`, `GET /api/usuarios/:id`, `PATCH /api/usuarios/:id`, todas con `autenticar` + `autorizar('administrador')` + `validar`; montarlo en `backend/src/routes/index.js`
- [X] T043 [US2] Implementar `frontend/src/pages/Usuarios.jsx` (listado paginado con filtros de rol y estado, activar o desactivar con `Confirmacion`) y `frontend/src/pages/UsuarioForm.jsx` (alta y edición; cuando el rol es `cliente` pedir el ID del cliente; mostrar errores por campo y mensajes de éxito), y agregar las rutas protegidas para administrador en `frontend/src/App.jsx`

**Checkpoint**: US1 y US2 funcionan; el personal puede darse de alta

---

## Phase 5: User Story 3 - Registro y modificación de clientes (Priority: P3)

**Goal**: Administrador y recepcionista registran y modifican clientes; solo el administrador da de baja o reactiva (FR-015..FR-018, FR-021).

**Independent Test**: Como recepcionista registrar un cliente con nombre, apellido y teléfono, modificarlo, probar datos faltantes y correo duplicado, y comprobar que dar de baja da 403 y que el administrador sí puede. La pantalla de edición carga el cliente con `GET /api/clientes/:id` (T058 de US4); la API se prueba completa sin esa pantalla.

### Tests for User Story 3 ⚠️

- [X] T044 [P] [US3] Prueba unitaria de `clientes.service` (escritura) en `backend/tests/unit/clientes.service.test.js` con modelos simulados: correo vacío se guarda como `null`, correo duplicado da 409, faltan nombre, apellido o teléfono da 400, no se puede cambiar ni quitar el correo si el cliente tiene cuenta (409), el estado solo lo cambia el administrador
- [X] T045 [P] [US3] Prueba de integración de escritura de clientes en `backend/tests/integration/clientes-escritura.test.js` (escenarios 8 a 12 y 14 de quickstart.md): alta 201, sin teléfono 400 indicando el campo, correo repetido 409, dos clientes sin correo 201, modificación 200, recepcionista baja 403, administrador baja y reactiva 200, entrenador crea o modifica 403
- [X] T046 [P] [US3] Prueba del frontend en `frontend/tests/cliente-form.test.jsx`: el formulario marca nombre, apellido y teléfono como obligatorios, deja correo y dirección opcionales y muestra el error de correo duplicado devuelto por la API

### Implementation for User Story 3

- [X] T047 [P] [US3] Implementar `backend/src/validators/cliente.validator.js` con `zod`, restricciones tal cual `data-model.md`: `nombre` obligatorio, recortado, máximo 80 (VARCHAR(80) NOT NULL, no vacío tras TRIM); `apellido` obligatorio, recortado, máximo 80 (VARCHAR(80) NOT NULL, no vacío tras TRIM); `telefono` obligatorio, máximo 20 (VARCHAR(20) NOT NULL, no vacío tras TRIM), solo dígitos, espacios, `+`, `-`, `(` y `)`; `correo` opcional, `""` o espacios se convierten en `null`, minúsculas, formato de correo, máximo 150 (VARCHAR(150) NULL, UNIQUE); `direccion` opcional, máximo 255 (VARCHAR(255) NULL); esquema de actualización con `minProperties: 1`; esquema de estado con `estado` en `activo|inactivo`; `fecha_registro` nunca se acepta
- [X] T048 [US3] Extender `backend/src/models/cliente.model.js` (depende de T014): `crear(datos)`, `actualizar(id, campos)`, `cambiarEstado(id, estado)`, `buscarPorCorreo(correo)`; solo `INSERT` y `UPDATE`, sin `DELETE`
- [X] T049 [US3] Implementar `backend/src/services/clientes.service.js` (escritura; depende de T048, T040): `crear`, `actualizar` (rechaza con 409 cambiar o quitar el correo si existe una cuenta vinculada, usando `buscarPorIdCliente`) y `cambiarEstado`; traducir duplicado de correo a 409
- [X] T050 [US3] Implementar `backend/src/controllers/clientes.controller.js` y `backend/src/routes/clientes.routes.js` (escritura): `POST /api/clientes` y `PATCH /api/clientes/:id` con `autorizar('administrador','recepcionista')`, y `PATCH /api/clientes/:id/estado` con `autorizar('administrador')`; todas con `autenticar` y `validar`; montarlo en `backend/src/routes/index.js`
- [X] T051 [US3] Implementar `frontend/src/pages/ClienteForm.jsx` (alta y edición; nombre, apellido y teléfono obligatorios; correo y dirección opcionales; errores por campo; mensaje de éxito; el administrador ve el control de baja o reactivación con `Confirmacion`) y agregar `/clientes/nuevo` y `/clientes/:id/editar` en `frontend/src/App.jsx` para administrador y recepcionista

**Checkpoint**: US1 a US3 funcionan; ya se pueden registrar clientes

---

## Phase 6: User Story 4 - Consulta de clientes por personal (Priority: P4)

**Goal**: Administrador, recepcionista y entrenador consultan la lista y el detalle; el entrenador solo ve nombre, apellido, estado y fecha de registro (FR-019).

**Independent Test**: Con clientes registrados consultar como administrador, recepcionista y entrenador y comprobar que el entrenador no recibe teléfono, correo ni dirección, y que la búsqueda y la paginación funcionan.

### Tests for User Story 4 ⚠️

- [X] T052 [P] [US4] Prueba unitaria de `vistaCliente` en `backend/tests/unit/vista-cliente.test.js`: administrador y recepcionista reciben todos los campos; el entrenador recibe solo `id_cliente, nombre, apellido, estado, fecha_registro`
- [X] T053 [P] [US4] Prueba de integración de consulta en `backend/tests/integration/clientes-consulta.test.js` (escenario 13 de quickstart.md): listado paginado con `q` y `estado`, detalle por id, 404 si no existe, el entrenador no recibe `telefono`, `correo` ni `direccion` en lista ni detalle, y el rol `cliente` recibe 403
- [X] T054 [P] [US4] Prueba del frontend en `frontend/tests/clientes-lista.test.jsx`: la lista oculta las columnas de contacto cuando el rol es entrenador y pagina correctamente

### Implementation for User Story 4

- [X] T055 [P] [US4] Implementar `backend/src/utils/vistaCliente.js`: `vistaCliente(fila, rol)` aplicando la tabla "Vista de datos por rol" de `data-model.md` (el entrenador solo `id_cliente, nombre, apellido, estado, fecha_registro`)
- [X] T056 [US4] Extender `backend/src/models/cliente.model.js` con `listar({ q, estado, limit, offset })` que busca por nombre, apellido o correo con `LIKE` parametrizado, ordena por `apellido, nombre` (índice `idx_clientes_nombre`) y devuelve el total
- [X] T057 [US4] Extender `backend/src/services/clientes.service.js` con `listar` y `obtener` (404 si no existe) aplicando `vistaCliente` según el rol del usuario autenticado
- [X] T058 [US4] Agregar a `backend/src/controllers/clientes.controller.js` y `backend/src/routes/clientes.routes.js` las rutas `GET /api/clientes` y `GET /api/clientes/:id` con `autorizar('administrador','recepcionista','entrenador')`
- [X] T059 [US4] Implementar `frontend/src/pages/Clientes.jsx` (lista con búsqueda, filtro de estado, paginación, insignia de estado, columnas según el rol, botón "Nuevo cliente" solo para administrador y recepcionista) y `frontend/src/pages/ClienteDetalle.jsx`; agregar las rutas en `frontend/src/App.jsx` para administrador, recepcionista y entrenador

**Checkpoint**: US1 a US4 funcionan; la pantalla de edición de US3 ya puede cargar clientes

---

## Phase 7: User Story 5 - Consulta de información propia por el cliente (Priority: P5)

**Goal**: Un cliente con cuenta consulta solo su propia información (FR-011, FR-020).

**Independent Test**: El administrador crea la cuenta de un cliente con correo, el cliente inicia sesión, consulta `/api/clientes/me` y recibe 403 al pedir otro cliente.

### Tests for User Story 5 ⚠️

- [X] T060 [P] [US5] Prueba de integración en `backend/tests/integration/cliente-propio.test.js` (escenarios 15 a 17 de quickstart.md): crear cuenta `cliente` para un cliente con correo (201, usa el correo del cliente), intentarlo con un cliente sin correo (409), una segunda cuenta para el mismo cliente (409), `GET /api/clientes/me` devuelve solo sus datos y `GET /api/clientes/{otro id}` devuelve 403
- [X] T061 [P] [US5] Prueba del frontend en `frontend/tests/mi-perfil.test.jsx`: la pantalla muestra solo los datos del cliente autenticado y el menú no ofrece listas de otros clientes

### Implementation for User Story 5

- [X] T062 [US5] Agregar `obtenerPropio(usuario)` en `backend/src/services/clientes.service.js`: usa `id_cliente` del usuario autenticado (nunca un id recibido en la petición) y devuelve todos los datos del propio cliente
- [X] T063 [US5] Agregar `GET /api/clientes/me` en `backend/src/controllers/clientes.controller.js` y `backend/src/routes/clientes.routes.js` con `autorizar('cliente')`, **registrada antes de `GET /api/clientes/:id`** para que `me` no se interprete como un id
- [X] T064 [US5] Implementar `frontend/src/pages/MiPerfil.jsx` y ajustar `frontend/src/pages/Inicio.jsx` y `frontend/src/App.jsx` para que el rol `cliente` solo vea "Mi información"

**Checkpoint**: Las cinco historias funcionan

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras que afectan a varias historias

- [X] T065 [P] Revisión de seguridad con búsquedas en el repositorio: ninguna sentencia `DELETE`, ningún `require(` ni `module.exports` en `backend/` ni `database/scripts/`, ningún SQL con valores concatenados, ningún `.env` ni secreto versionado, y que ninguna respuesta incluya `password` o detalles internos (SC-007, SC-010)
- [X] T066 [P] Reemplazar el campo "ID de cliente" de `frontend/src/pages/UsuarioForm.jsx` por un buscador que use `GET /api/clientes?q=` y solo ofrezca clientes con correo y sin cuenta
- [X] T067 [P] Verificar en `frontend/src/` que toda operación muestra mensaje de éxito o error, que las bajas piden confirmación y que el diseño se ve bien en pantalla pequeña (FR-024, Principio XI)
- [X] T068 [P] Actualizar `README.md` y `database/README.md` con los pasos finales de instalación, variables de entorno, creación del administrador inicial y ejecución de pruebas
- [X] T069 Ejecutar todas las pruebas (`npm test` en `backend/` y en `frontend/`) y corregir los fallos
- [X] T070 Recorrer los 22 escenarios de `specs/001-base-usuarios-clientes/quickstart.md` contra la base de pruebas `gymaccess_test` (**nunca** contra `gymaccess`; incluido el reinicio del backend del escenario 21) y marcar los resultados; confirmar la lista de "funcionalidad terminada" del Flujo de Desarrollo de la constitución

---

## Phase 9: Cambios posteriores solicitados por el equipo

**Purpose**: Ajustes de alcance pedidos después de definir las tareas originales.

- [X] T071 Un cliente dado de baja (estado inactivo) no puede iniciar sesión ni usar una sesión abierta; al reactivarlo recupera el acceso (FR-003b). Spec, `research.md` (D10), `data-model.md` y contrato actualizados; `backend/src/models/usuario.model.js` (LEFT JOIN a `clientes` → `estado_cliente`, sin cambiar el esquema), `backend/src/services/auth.service.js` y `backend/src/middlewares/autenticar.js`; pruebas en `backend/tests/unit/auth.service.test.js`, `backend/tests/unit/middlewares.test.js` y `backend/tests/integration/cliente-propio.test.js`
- [X] T072 Filtro `GET /api/clientes?para_cuenta=true` (solo administrador: clientes activos, con correo y sin cuenta) para alimentar el buscador de T066; `backend/src/validators/cliente.validator.js`, `backend/src/models/cliente.model.js`, `backend/src/services/clientes.service.js`, `backend/src/controllers/clientes.controller.js`, contrato OpenAPI y pruebas en `backend/tests/unit/vista-cliente.test.js` y `backend/tests/integration/clientes-consulta.test.js`
- [X] T073 Base de datos de pruebas separada `gymaccess_test`: `database/scripts/crear-bd-pruebas.sql` (se ejecuta como `root`), `backend/.env.test` y su plantilla, `npm test` con `--env-file=.env.test` y guardia en `backend/tests/helpers.js` que rechaza cualquier base cuyo nombre no termine en `_test`
- [X] T074 Robustecer la limpieza de las pruebas de integración (`after` siempre cierra servidor y pool, aunque falle un paso) en `backend/tests/integration/*.test.js` y `backend/tests/helpers.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup; bloquea todas las historias
- **User Stories (Phase 3 a 7)**: dependen de Foundational y se hacen en orden de prioridad (P1 → P5)
- **Polish (Phase 8)**: depende de las historias completadas

### User Story Dependencies

- **US1 (P1)**: tras Foundational; sin dependencias de otras historias
- **US2 (P2)**: tras Foundational; usa el login de US1 para sus pruebas con token
- **US3 (P3)**: tras Foundational; la API no depende de otras historias, la pantalla de edición necesita `GET /api/clientes/:id` de US4
- **US4 (P4)**: tras US3 para tener clientes que consultar (la API se prueba con datos creados en la propia prueba)
- **US5 (P5)**: tras US2 y US3 (crear la cuenta de cliente y tener un cliente con correo)

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de implementar
- Validadores y utilidades → modelos → servicios → controladores y rutas → pantallas
- `backend/src/routes/clientes.routes.js` y `backend/src/services/clientes.service.js` se amplían en US3, US4 y US5: no editar el mismo archivo en paralelo entre historias
- En `clientes.routes.js` la ruta `/me` va antes que `/:id`

### Parallel Opportunities

- Setup: T003, T004 y T005 en paralelo
- Foundational: T007 a T012, T014, T016, T018 a T021 en paralelo (archivos distintos)
- Cada historia: todas sus pruebas marcadas [P] en paralelo; validadores, serializadores y componentes de frontend marcados [P] en paralelo
- Con varias personas: tras US1, una persona puede hacer el backend de US2 y otra el de US3

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 juntas:
Task: "Prueba unitaria de intentos.service en backend/tests/unit/intentos.service.test.js"
Task: "Prueba unitaria de auth.service en backend/tests/unit/auth.service.test.js"
Task: "Prueba unitaria de middlewares en backend/tests/unit/middlewares.test.js"
Task: "Prueba de integración de login en backend/tests/integration/auth.test.js"

# Piezas independientes de US1 juntas:
Task: "Validador de login en backend/src/validators/auth.validator.js"
Task: "Serializador en backend/src/utils/serializadores.js"
Task: "Script crear-admin en database/scripts/crear-admin.js"
Task: "AuthContext en frontend/src/context/AuthContext.jsx"
```

---

## Implementation Strategy

### MVP First (solo User Story 1)

1. Completar Phase 1 (Setup) y Phase 2 (Foundational)
2. Completar Phase 3 (US1)
3. **Detenerse y validar**: crear el administrador, iniciar sesión, probar el bloqueo y las rutas protegidas

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 → probar → demostrar (acceso seguro)
3. US2 → probar → demostrar (alta de personal)
4. US3 → probar → demostrar (registro de clientes)
5. US4 → probar → demostrar (consulta por rol)
6. US5 → probar → demostrar (consulta propia)
7. Polish → cierre del sprint

### Parallel Team Strategy

1. Todos hacen Setup + Foundational juntos
2. Después: A hace US2, B hace US3 (archivos de backend distintos); US4 y US5 al cerrar ambas

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes
- [Story] vincula cada tarea con su historia para trazabilidad
- Las pruebas de integración crean datos con correos `test+...@example.com` en `gymaccess_test` y dejan esas cuentas inactivas
- Hacer commit tras cada tarea o grupo lógico; ramas con nombres como `feature/clientes`
- Evitar tareas vagas, conflictos en un mismo archivo y dependencias entre historias que rompan su independencia
