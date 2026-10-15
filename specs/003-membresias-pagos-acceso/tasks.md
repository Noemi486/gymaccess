---

description: "Lista de tareas de la funcionalidad 003: membresías, pagos, reconocimiento facial y control de acceso (Sprint 2)"
---

# Tasks: Membresías, pagos, reconocimiento facial y control de acceso (Sprint 2)

**Input**: Documentos de diseño en `/specs/003-membresias-pagos-acceso/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-sprint2.md, contracts/ui-sprint2.md, quickstart.md

**Tests**: Se incluyen tareas de prueba porque el spec las exige (FR-051, SC-014) y la constitución (Principio X). Backend: `node --test` contra la base `gymaccess_test`. Frontend: Vitest + Testing Library. Los descriptores faciales de prueba son vectores sintéticos de 128 números, nunca rostros reales.

**Organization**: Tareas agrupadas por historia de usuario. Las historias de prioridad P1 forman el flujo demostrable; las P2 y P3 se apoyan en ellas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario del spec (US1–US11)
- Cada tarea nombra los archivos exactos

## Path Conventions

- Backend: `backend/src/{config,utils,models,services,controllers,routes,validators,middlewares}/` y `backend/tests/{unit,integration}/`
- Frontend: `frontend/src/{lib,hooks,components,components/ui,pages,config,utils}/` y `frontend/tests/`
- Sin cambios en `database/` (no hay migraciones, FR-048)

## Reglas transversales (aplican a todas las tareas)

- ES Modules (`import`/`export`), nunca `require`; consultas SQL siempre parametrizadas; textos de interfaz y comentarios en español.
- **Nada de datos biométricos fuera del cifrado**: ningún serializador, respuesta, registro de consola, evento de auditoría ni mensaje de error puede contener `descriptor` o `descriptor_facial`; ninguna foto se envía ni se guarda.
- Las pruebas usan SOLO `gymaccess_test` (`backend/.env.test`); nunca escribir datos de prueba en `gymaccess`. No subir `.env` ni `.env.test`.
- Permisos validados en el servidor (`autenticar` + `autorizar`); la interfaz solo los refleja. Sin `DELETE`: bajas lógicas.
- Colores solo desde `frontend/src/styles/tokens.css`; componentes de `frontend/src/components/ui/`.
- Al cambiar el menú de un rol, actualizar en la misma tarea la lista esperada de `frontend/tests/menu.test.jsx`.
- Detenerse al terminar cada fase para que el equipo pruebe; actualizar `docs/estado.md` al cerrar la funcionalidad.

---

## Phase 1: Setup

- [X] T001 Instalar la única dependencia nueva con versión exacta: en `frontend/` ejecutar `npm install --save-exact @vladmandic/face-api@1.7.15` y verificar que `frontend/package.json` la lista sin `^` ni `~` y que no se agregó nada más (justificada en research.md R2 y R9)
- [X] T002 Copiar a `frontend/public/models/` SOLO los tres modelos de `frontend/node_modules/@vladmandic/face-api/model/` (`tiny_face_detector_model-weights_manifest.json` y `.bin`, `face_landmark_68_model-weights_manifest.json` y `.bin`, `face_recognition_model-weights_manifest.json` y `.bin`) y crear `frontend/public/models/LEEME.md` con el origen (paquete y versión), la licencia MIT, el tamaño de cada archivo y su huella SHA-256 (`Get-FileHash`); no copiar los modelos de edad, género, expresiones ni el detector SSD
- [X] T003 [P] Agregar `FACE_KEY=` SIN valor, con un comentario que indique "64 caracteres hexadecimales (32 bytes); si se pierde, los rostros deben registrarse de nuevo; generar con el comando de quickstart.md", a `backend/.env.example` y `backend/.env.test.example`
- [X] T004 Generar dos claves distintas (`node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log(randomBytes(32).toString('hex'))"`) y escribirlas como `FACE_KEY` en `backend/.env` y `backend/.env.test` (archivos locales, ignorados por Git; NUNCA mostrar ni commitear las claves)
- [X] T005 Confirmar la línea base antes de cambiar nada: `npm test` en `backend/` y en `frontend/` deben pasar (backend 214 + 1 omitida, frontend 171)

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: utilidades puras, cifrado, auditoría, serializadores y ayudantes de prueba usados por todas las historias.

### Utilidades y configuración del backend

- [X] T006 [P] Crear `backend/src/config/faceKey.js` con `leerFaceKey(valor)`: exige exactamente 64 caracteres hexadecimales y devuelve un `Buffer` de 32 bytes; si falta o es inválida lanza `Error('FACE_KEY debe tener 64 caracteres hexadecimales (32 bytes). Genera una con el comando de specs/003-membresias-pagos-acceso/quickstart.md.')` sin incluir el valor recibido; y prueba `backend/tests/unit/face-key.test.js` (válida, vacía, corta, larga, no hexadecimal, mayúsculas aceptadas, el mensaje no contiene la clave)
- [X] T007 Cargar la clave en `backend/src/config/env.js`: agregar `FACE_KEY` a las obligatorias y exponer `env.faceKey` (Buffer) usando `leerFaceKey`; el servidor y las pruebas deben detenerse con el mensaje claro si falta
- [X] T008 [P] Crear `backend/src/utils/dinero.js` con `aCentavos(valor)` (acepta número o texto `DECIMAL`; solo `/^\d+(\.\d{1,2})?$/`, si no lanza `Error`), `deCentavos(c)` (número con dos decimales) y `formatearMonto(c)` (`"$450.00"`), y `backend/tests/unit/dinero.test.js` (0.1+0.2 sin error de flotantes, `"450.00"`, `"450"`, `450.5`, tres decimales rechazados, negativos y NaN rechazados)
- [X] T009 [P] Crear `backend/src/utils/membresia.js` con `estadoEfectivo({ estado, fecha_inicio, fecha_fin, tiene_pago }, hoy)` según la tabla de research.md R1 (cancelada → suspendida → `fecha_fin < hoy` vencida → sin pago `pendiente_de_pago` → `fecha_inicio > hoy` `proxima` → `vigente`), `diasRestantes(fecha_fin, hoy)` (0 el último día, negativo si venció), `porVencer(m, hoy)` (vigente con 0 a 5 días), `calcularFechaFin(fecha_inicio, duracion)` (= inicio + duración − 1 día) y `sumarDias`; fechas como texto `YYYY-MM-DD` sin zona horaria; y `backend/tests/unit/membresia.test.js` con TODAS las filas de la tabla, los límites (vence hoy = 0 días y vigente, ayer = vencida, 5 y 6 días), año bisiesto y cambio de mes
- [X] T010 [P] Crear `backend/src/utils/cifradoFacial.js` con `cifrarDescriptor(descriptor[128], idCliente, clave)` → `Buffer` de 541 bytes (`0x01` ‖ IV aleatorio de 12 ‖ etiqueta de 16 ‖ 512 bytes de 128 `float32` little-endian cifrados con AES-256-GCM; datos autenticados `rostro:<id_cliente>`) y `descifrarDescriptor(blob, idCliente, clave)` → `Float32Array(128)`; errores genéricos (sin datos del descriptor) si la versión, longitud, etiqueta o `id_cliente` no coinciden; usar solo `node:crypto`; y `backend/tests/unit/cifrado-facial.test.js` (ida y vuelta con tolerancia de `float32`, IV distinto en cada cifrado, un byte alterado falla, blob de otro cliente falla, clave distinta falla, versión desconocida falla, longitud 541, el texto cifrado no contiene los bytes del descriptor en claro)
- [X] T011 [P] Crear `backend/src/utils/distanciaFacial.js` con `distanciaEuclidiana(a, b)` y `buscarCoincidencia(descriptor, candidatos, umbral = 0.5)` donde `candidatos` es `[{ id_cliente, descriptor }]`; devuelve `{ tipo: 'clara', id_cliente, distancia }` si exactamente UN cliente distinto queda a distancia ≤ umbral, `{ tipo: 'ninguna' }` si ninguno, y `{ tipo: 'ambigua' }` si dos o más clientes distintos quedan dentro del umbral; y `backend/tests/unit/distancia-facial.test.js` (distancia conocida, exactamente 0.5 coincide, 0.5001 no, un cliente con varios rostros cuenta como uno, dos clientes dentro del umbral → ambigua, lista vacía → ninguna)
- [X] T012 [P] Crear `backend/src/validators/descriptor.validator.js` con `descriptorEsquema` (zod): arreglo de EXACTAMENTE 128 números finitos, cada uno entre −5 y 5 inclusive, que no sean todos cero; los mensajes de error en español y sin repetir los valores recibidos; y `backend/tests/unit/descriptor-validator.test.js` (127 y 129 elementos, NaN, Infinity, cadena numérica, 5.0001, todos ceros, objeto, valor válido)
- [X] T013 [P] Crear `backend/src/utils/limitador.js` con `crearLimitador({ maximo, ventanaMs, ahora })` (ventana deslizante por clave, `intentar(clave)` devuelve `{ permitido, reintentarEnMs }`, limpia entradas viejas) y el middleware `limitarPorUsuario(limitador)` que usa `req.usuario.id_usuario` y responde 429 con el error estándar `{ error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Espera un momento.' } }` (agregar `TOO_MANY_REQUESTS` y `errorDemasiadasPeticiones` a `backend/src/utils/errores.js`); y `backend/tests/unit/limitador.test.js` con reloj inyectado (30 permitidas, la 31 no, tras la ventana vuelve a permitir, claves independientes)
- [X] T014 Configurar fechas de la base: en `backend/src/config/db.js` agregar `dateStrings: ['DATE']` al pool para que las columnas `DATE` (`fecha_inicio`, `fecha_fin`, `accesos.fecha`) lleguen como `YYYY-MM-DD` (los `DATETIME` y `TIME` no cambian); crear `backend/src/models/fecha.model.js` con `obtenerHoy(conexion = pool)` que ejecuta `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy`; comprobar con `npm test` en `backend/` que las pruebas existentes siguen pasando

### Auditoría y serializadores

- [X] T015 Crear `backend/src/models/auditoria.model.js` (`insertar({ id_usuario, accion, modulo, resultado, descripcion }, conexion = pool)`, solo `INSERT` parametrizado) y `backend/src/services/auditoria.service.js` con `registrarExito(conexion, datos)` (dentro de la transacción de la acción) y `registrarError(datos)` (después, sin impedir responder; si falla solo escribe `console.error` SIN el contenido), recortando `accion` a 100, `modulo` a 50 y `descripcion` a 500 caracteres y exponiendo las constantes de módulos y acciones de data-model.md (`tipos_membresia`: crear, modificar, desactivar, activar; `membresias`: asignar, renovar, suspender, reactivar, cancelar; `pagos`: registrar; `rostros`: registrar, reemplazar, desactivar, reactivar); rechazar descripciones que contengan la palabra `descriptor`; y `backend/tests/unit/auditoria.service.test.js` con un modelo simulado
- [X] T016 [P] Ampliar `backend/src/utils/serializadores.js` con `tipoMembresiaPublico`, `membresiaPublica(fila, hoy)` (objeto `Membresia` de contracts/api-sprint2.md con `estado` efectivo, `dias_restantes`, `por_vencer`, `precio`, `adeudo`, `pago`), `pagoPublico`, `accesoPublico` (con variante básica para el entrenador, sin `tipo` ni `motivo_rechazo`) y `rostroPublico` que devuelve SOLO `{ id_rostro, fecha_registro, estado }`; y `backend/tests/unit/serializadores-sprint2.test.js` (incluye una prueba que alimenta una fila con `descriptor_facial` y comprueba que no aparece en ninguna salida)
- [X] T017 [P] Ampliar `backend/tests/helpers.js` con ayudantes para pruebas (todos con datos `test+...` y limpieza por desactivación): `crearClienteDePrueba()`, `crearTipoMembresiaDePrueba({ precio, duracion })` (nombre único), `crearMembresiaDePrueba({ idCliente, idTipo, inicio, fin, estado, pagada })` (inserta directo con fechas relativas a la fecha de la base y, si `pagada`, un pago por el precio), `crearDescriptorSintetico(semilla)` (128 números deterministas distintos por semilla) y `descriptorCercano(base, distancia)` (vector a distancia euclidiana exacta de `base`), `crearUsuarioConRol(rol)` y `sinBiometria(cuerpo)` que falla si el JSON contiene `descriptor`; y `fechaRelativa(dias)` basada en la fecha de la base
- [X] T018 [P] Ampliar `frontend/src/utils/formato.js` con `formatearMoneda(numero)` (`450` → `"$450.00"`, miles con coma: `"$1,250.00"`) y `formatearFechaCorta(texto 'YYYY-MM-DD' | ISO)` (`"14 oct 2026"`, sin desfase de zona horaria), con pruebas en `frontend/tests/formato.test.js`
- [X] T019 [P] Ampliar `frontend/src/components/ui/Badge.jsx` con los estados de membresía (`vigente` → éxito "Vigente"; `por_vencer` → advertencia "Por vencer"; `pendiente_de_pago` → advertencia "Pendiente de pago"; `proxima` → información "Próxima"; `vencida` → error "Vencida"; `suspendida` → advertencia "Suspendida"; `cancelada` → error "Cancelada") y `autorizado`/`rechazado` ya existentes, y probar cada uno en `frontend/tests/ui.test.jsx` (siempre texto además del color)

**Checkpoint**: utilidades, cifrado, auditoría y ayudantes listos; `npm test` en backend y frontend pasan.

---

## Phase 3: User Story 1 - Tipos de membresía (Priority: P1) 🎯 MVP

**Goal**: el administrador gestiona los planes; el recepcionista los consulta.

**Independent Test**: como administrador crear, editar y desactivar un plan; como recepcionista solo verlo; entrenador y cliente reciben "Sin permiso".

### Tests for User Story 1

- [X] T020 [P] [US1] Crear `backend/tests/integration/tipos-membresia.test.js` (base `gymaccess_test`): 401 sin sesión; administrador crea (201) y consulta; validaciones `nombre` 1–80 caracteres, `descripcion` hasta 255, `duracion` entero de 1 a 3650, `precio` mayor a 0 con a lo más 2 decimales y máximo 99999999.99 (0, negativo, 3 decimales y texto → 400 con el campo); nombre repetido → 409 con detalle `nombre`; `PATCH` parcial y `PATCH /:id/estado`; el recepcionista recibe solo planes `activo` aunque pida `estado=inactivo`, puede `GET` pero recibe 403 en `POST`/`PATCH`; entrenador y cliente reciben 403; `GET /:id` devuelve además `membresias_pendientes_de_pago` (cantidad); no existen `DELETE` (404) ni `PUT`; cambiar el precio no modifica el `monto` de pagos existentes
- [X] T021 [P] [US1] Crear `frontend/tests/tipos-membresia.test.jsx`: tabla con nombre, duración, precio (formato de moneda) e insignia de estado; estado vacío; el administrador ve "Nuevo tipo", editar y activar/desactivar (con `ConfirmDialog` al desactivar); el recepcionista solo consulta; errores por campo (nombre repetido, precio 0); al guardar un precio distinto en un plan con `membresias_pendientes_de_pago > 0` aparece una advertencia que explica que afectará esos adeudos y pide confirmar

### Implementation for User Story 1

- [X] T022 [P] [US1] Crear `backend/src/validators/tipoMembresia.validator.js` (zod, `strictObject`) con `tipoCrearEsquema`, `tipoActualizarEsquema` (al menos un campo), `tipoEstadoEsquema` y `tipoListarQueryEsquema`, citando las restricciones de data-model.md: nombre 1–80, descripción ≤ 255 opcional, duración entero 1–3650, precio > 0 con ≤ 2 decimales y ≤ 99 999 999,99
- [X] T023 [US1] Crear `backend/src/models/tipoMembresia.model.js` (listar con filtros y paginación, buscar por id con la cuenta de membresías pendientes de pago —membresías de ese plan sin pago `registrado` y con `fecha_fin ≥ CURDATE()` que no estén canceladas—, crear, actualizar con lista cerrada de columnas, cambiar estado) con SQL parametrizado
- [X] T024 [US1] Crear `backend/src/services/tiposMembresia.service.js` (patrón `crearXService({ modelo, auditoria, conTransaccion })`): reglas de rol (el recepcionista solo planes activos), nombre repetido → `errorConflicto` con detalle `nombre`, precio como centavos con `dinero.js`, y eventos de auditoría `tipos_membresia`/`crear`, `modificar`, `desactivar`, `activar` en la misma transacción
- [X] T025 [US1] Crear `backend/src/controllers/tiposMembresia.controller.js` y `backend/src/routes/tiposMembresia.routes.js` (`GET /` A,R; `GET /:id` A,R; `POST /` A; `PATCH /:id` A; `PATCH /:id/estado` A) y montarlo como `/tipos-membresia` en `backend/src/routes/index.js`
- [X] T026 [US1] Actualizar `specs/003-membresias-pagos-acceso/contracts/api-sprint2.md`: `GET /tipos-membresia/:id` incluye `membresias_pendientes_de_pago`
- [X] T027 [P] [US1] Crear `frontend/src/components/FormularioTipoMembresia.jsx` (diálogo con `FormField`, `Input`, `Select`; precio con dos decimales; errores por campo; estado de carga) y `frontend/src/pages/TiposMembresia.jsx` (`PageHeader` con "Nuevo tipo" solo para el administrador, `Table`, `Badge`, `EmptyState`, `ConfirmDialog`, `useToast`, advertencia de precio con membresías pendientes)
- [X] T028 [US1] Agregar en `frontend/src/config/menu.js` el bloque `membresias-pagos` ("Membresías y pagos", entre "Operación" y "Administración") y la sección `tipos-membresia` (`/tipos-membresia`, ícono `Tags`, roles administrador y recepcionista); agregar la ruta protegida en `frontend/src/App.jsx`; y actualizar la lista esperada de `frontend/tests/menu.test.jsx`

**Checkpoint**: gestión de planes completa y probada. Detenerse para que el equipo pruebe.

---

## Phase 4: User Story 2 - Asignar, renovar y administrar la membresía (Priority: P1)

**Goal**: asignar y renovar membresías (quedan pendientes de pago) y que el administrador suspenda, reactive y cancele.

**Independent Test**: desde el detalle de un cliente asignar un plan (queda "Pendiente de pago"), renovar, y como administrador suspender, reactivar y cancelar.

### Tests for User Story 2

- [X] T029 [P] [US2] Crear `backend/tests/integration/membresias.test.js` (`gymaccess_test`, fechas relativas a la fecha de la base): asignar (201) con `fecha_fin = inicio + duración − 1`, queda `pendiente_de_pago` con `adeudo` = precio del plan; `fecha_inicio` por defecto hoy, anterior a hoy → 400, posterior a 60 días → 400; cliente inactivo → 409, inexistente → 404, plan inactivo → 409; segunda asignación con una en curso (vigente o pendiente) → 409; renovar con vigente que vence en el futuro → empieza el día siguiente a su fin (otra `fecha_inicio` → 400); renovar vencida → fecha indicada; renovar con renovación futura existente → 409; renovar con la en curso pendiente de pago → 409; `GET /clientes/:id/membresias` devuelve `actual`, `proxima` e `historial` con estados efectivos (vigente, proxima, pendiente_de_pago, vencida —sin guardar `vencida` en la base—, suspendida, cancelada); `PATCH /membresias/:id/estado` solo administrador (recepcionista 403) con `suspender`, `reactivar` (solo suspendida) y `cancelar` (no reversible, 409 al reactivar); entrenador y cliente 403; dos asignaciones simultáneas al mismo cliente → una 201 y una 409; ninguna respuesta contiene `descriptor`
- [X] T030 [P] [US2] Crear `frontend/tests/panel-membresia.test.jsx`: el detalle del cliente muestra la membresía actual (plan, fechas, `Badge` de estado, días restantes, adeudo), la próxima y el historial; estados vacíos; asignar con selector de planes activos y fecha; renovar; confirmaciones al suspender y cancelar; el recepcionista no ve suspender/reactivar/cancelar; errores del servidor (cliente con membresía en curso) como aviso

### Implementation for User Story 2

- [X] T031 [P] [US2] Crear `backend/src/validators/membresia.validator.js` (`membresiaAsignarEsquema` con `id_tipo_membresia` entero positivo, `fecha_inicio?` `YYYY-MM-DD` válida, `pago?` opcional que se completa en US3; `membresiaRenovarEsquema`; `membresiaEstadoEsquema` con `accion` ∈ `suspender`, `reactivar`, `cancelar`)
- [X] T032 [US2] Crear `backend/src/models/membresia.model.js`: `listarPorCliente(idCliente)` (con `LEFT JOIN` al pago `registrado` y al tipo), `buscarPorId(id, conexion, { bloquear })`, `buscarEnCurso`/`buscarProxima` por cliente (bloqueando con `FOR UPDATE`), `crear`, `cambiarEstado`; todo parametrizado
- [X] T033 [US2] Crear `backend/src/services/membresias.service.js` (`crearMembresiasService({ modelo, clienteModelo, tipoModelo, fechaModelo, auditoria, conTransaccion })`): dentro de una transacción bloquear la fila del cliente, validar cliente activo y plan activo, aplicar las reglas de FR-009 a FR-014 (una en curso, una renovación futura, la renovación empieza el día siguiente o en la fecha indicada, la pendiente de pago impide renovar), calcular `fecha_fin` con `calcularFechaFin`, devolver `membresiaPublica`, suspender/reactivar/cancelar solo desde el administrador y con las transiciones válidas (nunca escribir `vencida`), y auditar `membresias`/`asignar`, `renovar`, `suspender`, `reactivar`, `cancelar`
- [X] T034 [US2] Crear `backend/src/controllers/membresias.controller.js` y `backend/src/routes/membresias.routes.js` con `GET /clientes/:id/membresias` (A,R), `POST /clientes/:id/membresias` (A,R), `POST /membresias/:id/renovar` (A,R) y `PATCH /membresias/:id/estado` (A); montarlo en `backend/src/routes/index.js` en la raíz de `/api` (después de las rutas existentes de clientes)
- [X] T035 [P] [US2] Crear `frontend/src/components/AsignarMembresia.jsx` (diálogo: plan activo con su duración y precio, fecha de inicio, resumen de la fecha de fin; sin la opción de pago todavía) y `frontend/src/components/RenovarMembresia.jsx`
- [X] T036 [US2] Crear `frontend/src/components/PanelMembresia.jsx` (membresía actual con `Badge`, barra de días, adeudo; próxima; historial en `Table`; acciones según rol con `Button` y `ConfirmDialog`) y montarlo en `frontend/src/pages/ClienteDetalle.jsx` para administrador y recepcionista (no para el entrenador); estilos con tokens en `frontend/src/styles/estilos.css`

**Checkpoint**: asignación, renovación y gestión de estado probadas. Detenerse.

---

## Phase 5: User Story 3 - Registrar el pago completo (Priority: P1)

**Goal**: el pago completo activa la membresía; también se puede asignar y cobrar en una sola operación.

**Independent Test**: pagar una membresía pendiente (pasa a vigente y sale de Adeudos), rechazar monto distinto y segundo pago, y asignar con "Registrar el pago ahora".

### Tests for User Story 3

- [ ] T037 [P] [US3] Crear `backend/tests/integration/pagos.test.js` (`gymaccess_test`): `POST /pagos` por el monto exacto del plan → 201, la membresía pasa a `vigente` (o `proxima` si empieza después de hoy) y `adeudo` 0, el pago guarda `id_cliente`, `id_membresia`, `id_usuario` y `fecha_pago`; monto menor o mayor → 400 con detalle `monto` y mensaje "El pago debe ser por el monto completo: $450.00."; segundo pago → 409; membresía cancelada o vencida → 409; inexistente → 404; método inválido o ausente → 400; si el precio del plan cambió, se exige el vigente; dos pagos simultáneos de la misma membresía → uno 201 y uno 409; `POST /clientes/:id/membresias` y `POST /membresias/:id/renovar` con `pago` crean membresía y pago en UNA transacción (si el monto es incorrecto no se crea ninguna de las dos); recepcionista y administrador pueden, entrenador y cliente 403; no existen `PUT`/`PATCH`/`DELETE` sobre `/pagos`
- [ ] T038 [P] [US3] Crear `frontend/tests/registrar-pago.test.jsx`: diálogo con monto de solo lectura igual al adeudo y selector de método (efectivo, tarjeta, transferencia); envía `POST /pagos`; muestra el error del monto como error del campo; aviso de éxito y la membresía pasa a "Vigente"; la asignación con la casilla "Registrar el pago ahora" envía el pago junto con la membresía

### Implementation for User Story 3

- [ ] T039 [P] [US3] Crear `backend/src/validators/pago.validator.js` (`pagoCrearEsquema`: `id_membresia` entero positivo, `metodo_pago` ∈ `efectivo`, `tarjeta`, `transferencia`, `monto` número positivo con ≤ 2 decimales como número o texto; `pagoEnLineaEsquema` para el objeto `pago` anidado de asignar y renovar) y completar `membresiaAsignarEsquema`/`membresiaRenovarEsquema` con `pago` opcional
- [ ] T040 [US3] Crear `backend/src/models/pago.model.js` (`buscarPagoRegistrado(idMembresia, conexion)`, `crear({ id_cliente, id_membresia, monto, metodo_pago, id_usuario }, conexion)` con `INSERT` parametrizado) y `backend/src/services/pagos.service.js`: en transacción bloquear la membresía (`FOR UPDATE`), exigir que no esté cancelada, vencida ni ya pagada, comparar `aCentavos(monto)` con el precio vigente del plan, registrar el pago con el usuario de la sesión, auditar `pagos`/`registrar`, y devolver pago y membresía actualizada; exponer una función interna reutilizable `registrarPagoEnTransaccion` para asignar/renovar con pago
- [ ] T041 [US3] Ampliar `backend/src/services/membresias.service.js` para que asignar y renovar acepten `pago` y lo registren con `registrarPagoEnTransaccion` en la misma transacción (todo o nada)
- [ ] T042 [US3] Crear `backend/src/controllers/pagos.controller.js` y `backend/src/routes/pagos.routes.js` con `POST /` (A,R) (el `GET /` llega en US7) y montarlo como `/pagos` en `backend/src/routes/index.js`
- [ ] T043 [P] [US3] Crear `frontend/src/components/RegistrarPago.jsx` (diálogo accesible con monto de solo lectura, selector de método, `Button` con `cargando`, error de campo `monto`) e integrarlo: botón "Registrar pago" en `PanelMembresia.jsx` cuando la membresía está pendiente de pago, y casilla "Registrar el pago ahora" con selector de método en `AsignarMembresia.jsx` y `RenovarMembresia.jsx`

**Checkpoint**: flujo asignar → pagar probado de punta a punta. Detenerse.

---

## Phase 6: User Story 4 - Registrar el rostro de un cliente (Priority: P1)

**Goal**: guardar de forma cifrada el descriptor facial de un cliente, sin exponerlo jamás.

**Independent Test**: registrar el rostro con la cámara, ver "Rostro registrado", reemplazarlo, desactivarlo y reactivarlo; comprobar que ninguna respuesta contiene el descriptor.

### Tests for User Story 4

- [ ] T044 [P] [US4] Crear `backend/tests/integration/rostros.test.js` (`gymaccess_test`, descriptores sintéticos): `POST /clientes/:id/rostro` → 201 y la respuesta es solo `{ id_rostro, fecha_registro, estado }`; en la base `descriptor_facial` mide 541 bytes, empieza con `0x01`, NO contiene el vector en claro y se descifra con `FACE_KEY` al descriptor original; `consentimiento` ausente o `false` → 400; descriptor de 127/129 valores, NaN, fuera de ±5 o todo ceros → 400 y no se guarda nada; cliente inactivo → 409, inexistente → 404; registrar otro desactiva el anterior (siempre a lo más uno `activo`); dos registros simultáneos dejan un solo activo; `GET /clientes/:id/rostro` → `{ registrado, activo, historial }` sin datos biométricos; `PATCH /rostros/:id/estado` solo administrador (recepcionista 403): desactivar conserva el blob (no se borra), reactivar desactiva el activo actual; entrenador y cliente 403; cada respuesta pasa `sinBiometria`
- [ ] T045 [P] [US4] Crear `frontend/tests/registrar-rostro.test.jsx` con `reconocimientoFacial.js` y `navigator.mediaDevices` simulados: el diálogo exige marcar el consentimiento antes de capturar; muestra la cámara y las indicaciones (ningún rostro, varios rostros, poca luz); con muestras válidas envía `POST /clientes/:id/rostro` con 128 números y NINGUNA imagen (la petición no contiene `data:image` ni `Blob`); cámara denegada, sin cámara u ocupada muestran el mensaje y permiten reintentar; al cerrar se detienen todas las pistas de la cámara; `PanelRostro` muestra "Rostro registrado el …" o "Sin rostro registrado" y las acciones por rol (el recepcionista no desactiva ni reactiva)

### Implementation for User Story 4

- [ ] T046 [US4] Crear `backend/src/models/rostro.model.js` (listar por cliente, `buscarPorId`, `listarActivosConCliente()` con `id_rostro`, `id_cliente`, `descriptor_facial` y el estado del cliente, `insertar`, `cambiarEstado`, `desactivarActivosDeCliente`) con SQL parametrizado
- [ ] T047 [US4] Crear `backend/src/services/rostros.service.js` (módulo de reconocimiento, independiente del de acceso): `registrar(idCliente, descriptor, consentimiento, actor)` (transacción, bloqueo del cliente, cliente activo, desactiva los activos, cifra con `cifrarDescriptor` y `env.faceKey`, auditoría `rostros`/`registrar` o `reemplazar`), `cambiarEstado(idRostro, estado, actor)` solo administrador (auditoría `desactivar`/`reactivar`; reactivar desactiva el activo del cliente), `consultar(idCliente)` con `rostroPublico`, y `encontrarCoincidencia(descriptor)` que descifra los rostros activos (omitiendo y registrando sin datos los que no se puedan descifrar), usa `buscarCoincidencia` con umbral 0.5 y devuelve `{ tipo, id_cliente? }`; nunca registra ni devuelve el descriptor
- [ ] T048 [US4] Crear `backend/src/validators/rostro.validator.js` (`rostroRegistrarEsquema`: `descriptor` con `descriptorEsquema` y `consentimiento` literal `true`; `rostroEstadoEsquema`), `backend/src/controllers/rostros.controller.js` y `backend/src/routes/rostros.routes.js` (`GET /clientes/:id/rostro` A,R; `POST /clientes/:id/rostro` A,R; `PATCH /rostros/:id/estado` A) y montarlo en `backend/src/routes/index.js`
- [ ] T049 [P] [US4] Crear `frontend/src/lib/reconocimientoFacial.js`, única puerta a `@vladmandic/face-api` según contracts/ui-sprint2.md: `cargarModelos()` (importa la biblioteca con `import()` y carga tinyFaceDetector, faceLandmark68Net y faceRecognitionNet desde `/models`, una sola vez, con error claro), `analizarFotograma(video)` (estados `sin_rostro`, `varios`, `lejos` si el rostro mide menos del 25 % del ancho, `baja_confianza` si < 0,6, `ok` con `Float32Array(128)`) y `capturarMuestras(video, { cantidad: 5, intervaloMs: 300 })` (descarta la captura si dos muestras difieren más de 0,4 y devuelve el promedio como arreglo de 128 números); no guardar nunca imágenes ni canvas exportables
- [ ] T050 [P] [US4] Crear `frontend/src/hooks/useCamara.js` (`getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })`, estados `inactiva`, `solicitando`, `activa`, `denegada`, `sin_camara`, `ocupada`, detiene todas las pistas al desmontar o llamar a `detener`) y `frontend/src/components/CamaraFacial.jsx` (`<video>` con marco de escáner de esquinas verdes, mensajes de ayuda y de error con instrucciones para habilitar el permiso); estilos con tokens
- [ ] T051 [US4] Crear `frontend/src/components/RegistrarRostro.jsx` (consentimiento obligatorio, `CamaraFacial`, captura de 5 muestras, envío a la API, errores y reintento) y `frontend/src/components/PanelRostro.jsx` (estado del rostro, registrar o reemplazar, y para el administrador desactivar y reactivar con `ConfirmDialog`); montar `PanelRostro` en `frontend/src/pages/ClienteDetalle.jsx` para administrador y recepcionista
- [ ] T052 [US4] Verificar el empaquetado: `npm run build` en `frontend/` debe compilar con la biblioteca en un fragmento cargado de forma diferida (no en el paquete inicial) y con `public/models` copiado a `dist/models`; ajustar `frontend/vite.config.js` solo si es necesario (por ejemplo, el límite de aviso del tamaño del fragmento)

**Checkpoint**: registro de rostro probado en pruebas automáticas; probar a mano con la cámara real (paso 4 de quickstart.md). Detenerse.

---

## Phase 7: User Story 5 - La Estación de acceso (Priority: P1)

**Goal**: identificar al cliente con su rostro, validar membresía vigente y pagada, y registrar cada intento.

**Independent Test**: abrir `/estacion` y presentar cliente al corriente (autorizado), con adeudo, vencido, suspendido, cancelado, sin membresía, dado de baja y desconocido (rechazos con su motivo); verificar 3 fallos seguidos y los registros.

### Tests for User Story 5

- [ ] T053 [P] [US5] Crear `backend/tests/integration/accesos-identificar.test.js` (`gymaccess_test`, descriptores sintéticos con `descriptorCercano`): autorizado con cliente al corriente → 200 `resultado: autorizado` con nombre, plan, `fecha_fin` y `dias_restantes`, y UNA fila nueva en `accesos` (`id_cliente`, `tipo: entrada`, `resultado`); cada rechazo con su motivo exacto y fila registrada: `Rostro no reconocido` (sin coincidencia a distancia > 0,5, coincidencia ambigua con dos clientes, y rostro `inactivo` no coincide), `Cliente dado de baja`, `Sin membresía`, `Pago pendiente` (cubre hoy sin pago), `Membresía vencida`, `Membresía suspendida`, `Membresía cancelada`; límite del umbral (distancia 0,5 coincide, 0,51 no); cliente con vigente pagada y renovación futura impaga → autorizado; descriptor inválido → 400 SIN fila; la respuesta de rechazo sin identificar no incluye `cliente`; entrenador y cliente 403; sin sesión 401; más de 30 peticiones por minuto de un usuario → 429; ninguna respuesta contiene `descriptor`; la fila rechazada cumple las restricciones (motivo no vacío; autorizado con cliente)
- [ ] T054 [P] [US5] Crear `frontend/tests/estacion-estado.test.js` (prueba pura del reductor de la estación, con reloj simulado): espera → analizando → resultado; el resultado dura 5 s y vuelve a la espera; enfriamiento de 10 s para no reenviar mientras la misma persona sigue ahí; 3 "Rostro no reconocido" seguidos → pausa de 30 s con el mensaje "No te reconocemos. Pide ayuda en recepción" y el conteo vuelve a 0 al terminar; un cliente identificado (aunque rechazado por otro motivo) reinicia el conteo; durante la pausa no se envía nada; con varios rostros o ninguno no se envía nada
- [ ] T055 [P] [US5] Crear `frontend/tests/estacion-acceso.test.jsx` con la cámara y `reconocimientoFacial.js` simulados: la ruta `/estacion` se muestra SIN menú lateral ni encabezado; solo administrador y recepcionista (entrenador y cliente ven "Sin permiso"); autorizado en verde con nombre, plan y días; rechazado en rojo con nombre y motivo exacto (incluido "Pago pendiente"); "Rostro no reconocido" no muestra nombre; solo se envía `POST /accesos/identificar` con 128 números; mensajes de cámara denegada o sin cámara; "Salir" apaga la cámara y vuelve al sistema; sesión vencida pide iniciar sesión sin registrar intentos

### Implementation for User Story 5

- [ ] T056 [US5] Crear `backend/src/models/acceso.model.js` (`insertar({ id_cliente, resultado, motivo_rechazo }, conexion)` usando los valores por defecto de la base para `fecha` y `hora` y `tipo = 'entrada'`, `listar` llega en US6)
- [ ] T057 [US5] Crear `backend/src/services/accesos.service.js` (control de acceso, independiente del reconocimiento): `identificar(descriptor, actor)` pide a `rostros.service.encontrarCoincidencia`, obtiene cliente y su membresía en curso con `membresias.service` (o el modelo), decide en el orden de data-model.md (cliente activo → en curso → pagada → vigente) con los motivos exactos, calcula `dias_restantes`, **registra siempre un acceso** (autorizado o rechazado, con `id_cliente` solo si se identificó) y devuelve la forma de contracts/api-sprint2.md; la fecha de hoy sale de la base
- [ ] T058 [US5] Crear `backend/src/validators/acceso.validator.js` (`identificarEsquema` con `descriptor`), `backend/src/controllers/accesos.controller.js` y `backend/src/routes/accesos.routes.js` con `POST /identificar` (A,R) protegido por `limitarPorUsuario` (30 por minuto) y montarlo como `/accesos` en `backend/src/routes/index.js`
- [ ] T059 [P] [US5] Crear `frontend/src/hooks/useEstacion.js` con el reductor puro (estados `cargando_modelos`, `espera`, `analizando`, `resultado`, `pausa`, `error_camara`), el conteo de "Rostro no reconocido" consecutivos, el enfriamiento de 10 s y las duraciones de 5 s y 30 s (reloj inyectable), más el ciclo que analiza ~4 veces por segundo con `analizarFotograma` y envía el descriptor solo con exactamente un rostro estable (3 fotogramas)
- [ ] T060 [US5] Crear `frontend/src/pages/EstacionAcceso.jsx` a pantalla completa (fondo oscuro, `CamaraFacial` grande con esquinas de escáner, panel de resultado verde/rojo con nombre, plan, días y motivo, mensaje de pausa, estado de carga de los modelos, botón "Salir" y botón "Pantalla completa" con `requestFullscreen`, detiene la cámara al salir) con estilos con tokens
- [ ] T061 [US5] Agregar la ruta `/estacion` en `frontend/src/App.jsx` FUERA del `Layout` (con `RutaProtegida` para administrador y recepcionista) y la sección `estacion` en `frontend/src/config/menu.js` (bloque `operacion`, ícono `ScanFace`, roles administrador y recepcionista, enlace normal); actualizar `frontend/tests/menu.test.jsx`

**Checkpoint**: flujo principal completo (membresía → pago → rostro → entrada). Probar a mano con la cámara (pasos 5 a 7 de quickstart.md). Detenerse. **MVP funcional de la demostración.**

---

## Phase 8: User Story 6 - Consultar los accesos (Priority: P2)

**Goal**: listar intentos de acceso con filtros; el entrenador ve la versión básica.

**Independent Test**: generar accesos y abrir "Accesos" con administrador, recepcionista y entrenador.

### Tests for User Story 6

- [ ] T062 [P] [US6] Crear `backend/tests/integration/accesos-listar.test.js`: `GET /accesos` ordenado del más reciente al más antiguo con paginación; filtros `desde`, `hasta` (fechas válidas, `desde ≤ hasta`), `resultado` y `q` por nombre/apellido; cliente `null` como "No identificado"; administrador y recepcionista reciben el detalle completo (`tipo`, `motivo_rechazo`); el entrenador recibe SOLO nombre, fecha, hora y resultado (sin `tipo`, `motivo_rechazo`, teléfono ni correo); cliente 403; no existen `PUT`/`PATCH`/`DELETE`
- [ ] T063 [P] [US6] Crear `frontend/tests/accesos.test.jsx`: tabla con fecha y hora, cliente o "No identificado", insignia de resultado y motivo; filtros de fecha o rango, resultado y búsqueda; estado vacío; paginación; vista básica para el entrenador

### Implementation for User Story 6

- [ ] T064 [US6] Ampliar `backend/src/models/acceso.model.js` con `listar({ desde, hasta, resultado, q, limit, offset })` (unión con `clientes`, filtros parametrizados, rangos por `fecha` para aprovechar `idx_accesos_fecha`), `backend/src/services/accesos.service.js` con `listar(filtros, actor)` (proyección por rol con `accesoPublico`), el validador `accesoListarQueryEsquema` en `backend/src/validators/acceso.validator.js` y `GET /` (A,R,E) en `backend/src/routes/accesos.routes.js`
- [ ] T065 [P] [US6] Crear `frontend/src/pages/Accesos.jsx` (`PageHeader`, filtros con `FormField`, `Table`, `Badge` de resultado, `Pagination`, `EmptyState`) y agregar la sección `accesos` (`/accesos`, ícono `DoorOpen`, bloque `operacion`, roles administrador, recepcionista y entrenador) en `frontend/src/config/menu.js`, la ruta en `frontend/src/App.jsx` y la lista esperada de `frontend/tests/menu.test.jsx`

---

## Phase 9: User Story 7 - Consultar pagos y adeudos (Priority: P2)

**Goal**: historial de pagos y lista de adeudos para administrador y recepcionista.

**Independent Test**: con membresías pagadas y pendientes abrir "Pagos" y "Adeudos" y comparar cifras.

### Tests for User Story 7

- [ ] T066 [P] [US7] Crear `backend/tests/integration/pagos-adeudos.test.js`: `GET /pagos` paginado (más reciente primero) con `desde`, `hasta`, `metodo_pago`, `q` y `total_monto` que suma solo lo filtrado; `GET /adeudos` lista solo membresías `pendiente_de_pago` con `adeudo` = precio vigente, ordenadas por `fecha_inicio` ascendente, con `total_adeudo`; una membresía pagada desaparece; canceladas, suspendidas y vencidas no aparecen; administrador y recepcionista 200, entrenador y cliente 403; las cifras coinciden con la suma de los pagos creados
- [ ] T067 [P] [US7] Crear `frontend/tests/pagos-adeudos.test.jsx`: Pagos con filtros, total y botón "Registrar pago" (búsqueda de cliente y membresía pendiente); Adeudos con adeudo por fila, acceso directo a registrar el pago y estado vacío; el entrenador y el cliente no ven las secciones

### Implementation for User Story 7

- [ ] T068 [US7] Ampliar `backend/src/models/pago.model.js` (`listar` con filtros y suma, `listarAdeudos` con `LEFT JOIN` a pagos y filtro de membresías `activa` sin pago y `fecha_fin ≥ CURDATE()`), `backend/src/services/pagos.service.js` (`listar`, `listarAdeudos` con `pagoPublico` y centavos), los validadores de consulta en `backend/src/validators/pago.validator.js`, y `GET /` en `backend/src/routes/pagos.routes.js` más `backend/src/routes/adeudos.routes.js` (`GET /` A,R) montado como `/adeudos` en `backend/src/routes/index.js`
- [ ] T069 [P] [US7] Crear `frontend/src/pages/Pagos.jsx` y `frontend/src/pages/Adeudos.jsx` con los componentes comunes, y agregar las secciones `pagos` (`/pagos`, ícono `Wallet`) y `adeudos` (`/adeudos`, ícono `ReceiptText`) al bloque `membresias-pagos` de `frontend/src/config/menu.js` para administrador y recepcionista, las rutas en `frontend/src/App.jsx` y la lista esperada de `frontend/tests/menu.test.jsx`

---

## Phase 10: User Story 8 - Dashboard del administrador (Priority: P2)

**Goal**: tablero con filtro de periodo y cifras coherentes con las listas.

**Independent Test**: con datos conocidos cambiar entre hoy, semana, mes y rango y comparar con las listas.

### Tests for User Story 8

- [ ] T070 [P] [US8] Crear `backend/tests/integration/dashboard.test.js`: `GET /dashboard` (solo administrador; recepcionista, entrenador y cliente 403) con `periodo` `hoy` (predeterminado), `semana` (lunes a hoy), `mes` (día 1 a hoy) y `rango`; rangos inválidos (desde > hasta, fechas futuras, más de 366 días, formato) → 400; las cifras de estado actual (`clientes_activos`, `con_membresia_vigente`, `con_membresia_vencida`, `con_membresia_por_vencer` ⊆ vigente) NO cambian con el periodo; `ingresos` suma pagos `registrado` del periodo (incluye pagos del primer y último segundo del rango); `accesos_autorizados`, `accesos_rechazados` por `fecha`; `accesos_recientes` máximo 10 del periodo; cada cifra coincide con `GET /clientes`, `/pagos` y `/accesos` filtrados; las pendientes de pago no cuentan como vigentes; un cliente cuenta en una sola categoría
- [ ] T071 [P] [US8] Crear `frontend/tests/dashboard.test.jsx`: periodo predeterminado "Hoy" con sus fechas visibles; tarjetas `StatCard` de las 7 cifras con moneda formateada; cambiar el periodo vuelve a pedir los datos con los parámetros correctos; el selector de rango valida y muestra errores; el texto aclara que las tarjetas de clientes son "a la fecha de hoy"; lista de accesos recientes con estado vacío; error de carga conserva el resto; solo el administrador ve la sección

### Implementation for User Story 8

- [ ] T072 [US8] Crear `backend/src/models/dashboard.model.js` (consultas agregadas parametrizadas: clientes activos, conteos de categorías con el estado efectivo calculado en SQL de forma equivalente a `utils/membresia.js`, suma de ingresos por rango de `fecha_pago`, conteo de accesos por resultado y por rango de `fecha`, últimos 10 accesos), `backend/src/services/dashboard.service.js` (resuelve el periodo con la fecha de la base: semana de lunes a hoy, mes desde el día 1, valida el rango y devuelve la forma de contracts/api-sprint2.md), `backend/src/validators/dashboard.validator.js`, `backend/src/controllers/dashboard.controller.js` y `backend/src/routes/dashboard.routes.js` (`GET /` solo administrador) montado como `/dashboard`
- [ ] T073 [US8] Crear `frontend/src/pages/Dashboard.jsx` (`PageHeader`, filtro de periodo con botones Hoy/Semana/Mes/Rango y dos `Input type="date"` para el rango, las fechas del periodo siempre visibles, `StatCard` por cifra con ícono, aclaración del "estado actual", lista de accesos recientes con `Table`/`Badge`, `Spinner`, aviso de error) y agregar la sección `dashboard` (`/dashboard`, ícono `LayoutDashboard`, bloque `general`, solo administrador) en `frontend/src/config/menu.js`, la ruta en `frontend/src/App.jsx` y la lista esperada de `frontend/tests/menu.test.jsx`

---

## Phase 11: User Story 9 - Inicio de cada rol con la información de Sprint 2 (Priority: P2)

**Goal**: activar los espacios reservados del Inicio de cliente, administrador, recepcionista y entrenador.

**Independent Test**: entrar con cada rol y comprobar que aparecen exactamente sus elementos.

### Tests for User Story 9

- [ ] T074 [P] [US9] Crear `backend/tests/integration/resumen-sprint2.test.js`: `GET /resumen` suma para administrador y recepcionista `accesos.hoy` y `membresias.por_vencer` (coinciden con `GET /accesos` y con las membresías); para el entrenador `accesos.clientes_hoy` (clientes DISTINTOS con acceso autorizado hoy) y `accesos.ultimos` con solo `id_cliente`, nombre, apellido y hora (sin contacto ni datos financieros); las claves existentes no cambian; `GET /clientes/me/resumen` solo para el rol cliente (los demás 403) y solo con datos propios: `membresia`, `rostro` (booleano y fecha, sin biometría), últimas 5 `visitas` con motivo, últimos 5 `pagos` y `adeudo`; dos clientes no se ven entre sí; ninguna respuesta contiene `descriptor`
- [ ] T075 [P] [US9] Crear `frontend/tests/inicio-sprint2.test.jsx`: el cliente ve las 4 tarjetas con datos y con estados vacíos ("Aún no tienes una membresía", "Aún no tienes visitas registradas", "Aún no tienes pagos registrados"); la barra de "Mi membresía" es verde, amarilla con 5 días o menos y roja si está vencida, siempre con texto; "Pendiente de pago" en amarillo con el monto y sin barra; "Acceso facial" muestra "Registrado" o "No registrado" sin datos biométricos; administrador y recepcionista ven "Accesos de hoy" y "Membresías por vencer"; el entrenador ve "Clientes que entraron hoy" con su lista básica; "Mis clientes asignados" y rutinas no aparecen

### Implementation for User Story 9

- [ ] T076 [US9] Ampliar `backend/src/models/resumen.model.js` y `backend/src/services/resumen.service.js` con las entradas nuevas por rol (patrón de `ENTRADAS`: `accesos` para A,R con `hoy` y `membresias` con `por_vencer`; `accesos` para E con `clientes_hoy` y `ultimos`), y crear `backend/src/services/miResumen.service.js`, `backend/src/controllers/miResumen.controller.js` y la ruta `GET /clientes/me/resumen` (solo cliente) en `backend/src/routes/clientes.routes.js` ANTES de `GET /:id`
- [ ] T077 [P] [US9] Crear las tarjetas `frontend/src/components/tarjetasCliente/MiMembresia.jsx` (barra de progreso con los umbrales del diseño, texto "Vence en N días"/"Vence hoy"/"Vencida hace N días", "Pendiente de pago"), `AccesoFacial.jsx`, `MisVisitas.jsx` y `MisPagos.jsx`, con `Card`, `Badge`, `EmptyState` y estilos con tokens
- [ ] T078 [US9] Activar lo reservado: en `frontend/src/config/tarjetasCliente.js` asignar `componente` y `disponible: true` a las 4 tarjetas; en `frontend/src/config/indicadores.js` poner `disponible: true` en `accesos-hoy` y `membresias-por-vencer` y agregar `clientes-entraron-hoy` (entrenador, valor `accesos.clientes_hoy`); en `frontend/src/pages/Inicio.jsx` pedir `GET /clientes/me/resumen` para el cliente y mostrar la lista "Clientes que entraron hoy" del entrenador reutilizando `ClientesNuevos.jsx` o un componente hermano; actualizar `frontend/tests/inicio.test.jsx` donde afirma que los indicadores y tarjetas del Sprint 2 están reservados y ocultos (las pruebas de `INDICADORES` y de `TARJETAS_CLIENTE` pasan a verificar que ahora están disponibles)

---

## Phase 12: User Story 10 - Menú lateral con las secciones del Sprint 2 (Priority: P2)

**Goal**: confirmar que el menú de cada rol coincide con el Anexo del spec.

**Independent Test**: comparar el menú de los 4 roles con la tabla del Anexo.

- [ ] T079 [P] [US10] Completar `frontend/tests/menu.test.jsx` con la matriz final por rol: administrador (Inicio, Dashboard, Clientes, Accesos, Estación de acceso, Tipos de membresía, Pagos, Adeudos, Usuarios y roles), recepcionista (Inicio, Clientes, Accesos, Estación de acceso, Tipos de membresía, Pagos, Adeudos), entrenador (Inicio, Clientes, Accesos), cliente (Inicio, Mi información); orden de bloques General, Operación, Membresías y pagos, Administración; ningún bloque vacío; título del encabezado y resaltado en cada sección nueva, incluida la ruta `/estacion` que no usa el `Layout`
- [ ] T080 [P] [US10] Crear `frontend/tests/permisos-sprint2.test.jsx`: para cada ruta nueva y cada rol no permitido se muestra "Sin permiso" y no se hace ninguna petición de datos; sin sesión se redirige a `/login`
- [ ] T081 [US10] Revisar `frontend/src/config/menu.js` y `frontend/src/App.jsx`: títulos del encabezado para subrutas, iconos y orden finales; ajustar si hace falta

---

## Phase 13: User Story 11 - Auditoría de acciones importantes (Priority: P3)

**Goal**: cada acción importante deja su evento, sin datos sensibles y sin forma de modificarlo.

**Independent Test**: realizar cada acción y verificar el evento en la base de pruebas.

- [ ] T082 [P] [US11] Crear `backend/tests/integration/auditoria.test.js` (`gymaccess_test`): por cada acción de data-model.md (crear/modificar/desactivar/activar tipo; asignar, renovar, suspender, reactivar, cancelar membresía; registrar pago; registrar, reemplazar, desactivar y reactivar rostro) existe un evento con `id_usuario` correcto, `accion`, `modulo`, `resultado = exito`, fecha y descripción breve; una acción que falla por regla de negocio (por ejemplo, monto incorrecto) deja un evento `error`; si la acción falla y se revierte la transacción, NO queda evento de éxito; ninguna descripción contiene `descriptor`, contraseñas ni vectores; los intentos de acceso NO generan eventos de auditoría; no existe ninguna ruta para consultarla, modificarla o borrarla
- [ ] T083 [US11] Revisar que todos los servicios (`tiposMembresia`, `membresias`, `pagos`, `rostros`) llamen a `auditoria.service.js` con los nombres exactos de acción y módulo de data-model.md, y registren los eventos de error para validaciones y permisos al intentar la operación; completar lo que falte según los resultados de T082

---

## Phase 14: Polish & Cross-Cutting

- [ ] T084 [P] Crear `backend/tests/integration/sin-biometria.test.js`: recorrer los endpoints del Sprint 2 con datos reales de prueba (rostros registrados) y comprobar con `sinBiometria` que NINGUNA respuesta, de éxito o de error, contiene `descriptor` ni `descriptor_facial`, y que `console.error`/`console.log` no recibieron el descriptor durante las pruebas
- [ ] T085 [P] Revisión de seguridad: confirmar que `.env` y `.env.test` siguen ignorados por Git, que `.env.example` y `.env.test.example` llevan `FACE_KEY=` sin valor, que `git grep -n "FACE_KEY"` no muestra valores reales, que ninguna ruta del Sprint 2 omite `autenticar` y `autorizar`, y que no existe `DELETE` en SQL ni en rutas
- [ ] T086 [P] Revisar accesibilidad y diseño de las pantallas nuevas con los tokens: contraste, foco visible, textos con color e insignia, adaptación de 360 a 1920 px y menú en pantallas pequeñas; corregir lo que falte en `frontend/src/styles/estilos.css`
- [ ] T087 Ejecutar todo: `npm test` en `backend/` (contra `gymaccess_test`) y `npm test` y `npm run build` en `frontend/`; todo debe pasar (SC-014), incluidas las pruebas de los sprints anteriores
- [ ] T088 Recorrer `specs/003-membresias-pagos-acceso/quickstart.md` con la cámara real de la laptop y los 4 roles (registro de rostro, entrada autorizada y rechazos, 3 intentos fallidos, Dashboard, Inicios, permisos) y anotar los resultados; es una comprobación manual del equipo
- [ ] T089 Actualizar `docs/estado.md` (funcionalidad 003 terminada, decisiones: pendiente de pago derivado, `@vladmandic/face-api`, `FACE_KEY`, 3 intentos, limitación de detección de vida, pendientes) y actualizar la nota de `specs/002-interfaz-menu-lateral/spec.md` indicando que los espacios reservados quedaron activados por la funcionalidad 003

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (1) → Foundational (2) → historias → Polish (14).
- Foundational bloquea todas las historias.

### User story dependencies

- **US1 (tipos)**: solo Foundational.
- **US2 (membresías)**: depende de US1 (necesita planes).
- **US3 (pagos)**: depende de US2 (necesita membresías) y amplía su servicio.
- **US4 (rostro)**: depende de Foundational (cifrado, descriptor) y del detalle del cliente; independiente de US1–US3 en backend, pero se prueba con clientes ya creados.
- **US5 (estación)**: depende de US2, US3 y US4 (membresía pagada + rostro).
- **US6 (accesos)**: depende de US5 (modelo y servicio de accesos).
- **US7 (pagos y adeudos)**: depende de US3.
- **US8 (dashboard)**: depende de US2, US3, US5 (datos para las cifras).
- **US9 (inicios)**: depende de US2, US3, US4, US5.
- **US10 (menú)**: se construye con cada historia y se verifica al final.
- **US11 (auditoría)**: los eventos se escriben en US1–US4; esta fase los verifica y completa.

### Within each story

Pruebas primero cuando sea posible → validadores → modelo → servicio → controlador y rutas → pantalla → menú y ruta → ejecutar `npm test`.

### Parallel opportunities

- Foundational: T006, T008–T013, T016–T019 en paralelo (archivos distintos); T007 y T014 secuenciales.
- US1: T020, T021 y T022 en paralelo; T027 en paralelo con el backend.
- US4: T044 y T045 en paralelo; T049 y T050 en paralelo con el backend (T046–T048).
- US5: T053–T055 en paralelo; T059 en paralelo con el backend.
- US6, US7 y US8 son independientes entre sí tras US5/US3 y pueden avanzar en paralelo con dos personas.

### Parallel example: Foundational

```text
T006 faceKey    T008 dinero    T009 membresia    T010 cifradoFacial    T011 distanciaFacial
T012 descriptor    T013 limitador    T016 serializadores    T017 helpers    T018 formato    T019 Badge
```

---

## Implementation Strategy

### MVP primero (flujo demostrable)

1. Fases 1–2 (setup y fundamentos) → detenerse y probar.
2. Fases 3–5 (US1–US3): planes, membresías y pagos → detenerse.
3. Fases 6–7 (US4–US5): rostro y estación → probar a mano con la cámara → **demostración del MVP** (criterio del acta: entra solo quien está al corriente, se rechaza al vencido o no registrado y se registra cada intento).

### Entrega incremental

Después: US6 (accesos), US7 (pagos y adeudos), US8 (dashboard), US9 (inicios), US10 (menú), US11 (auditoría) y Polish. Detenerse al final de cada fase para que el equipo pruebe, como indica CLAUDE.md, y actualizar `docs/estado.md` al cerrar.

---

## Notes

- Ninguna tarea modifica `database/`; ninguna crea tablas, columnas ni migraciones.
- Única dependencia nueva: `@vladmandic/face-api@1.7.15` (T001); el backend usa `node:crypto`.
- Los ajustes acordados con el equipo: 3 intentos fallidos con pausa de 30 s, planes con precio mayor a 0, membresía pendiente de pago cobrada al precio vigente del plan, detección de vida fuera de alcance.
- Hacer commits pequeños, por tarea o grupo lógico, en `feature/sprint-2`.
