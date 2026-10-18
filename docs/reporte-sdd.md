# Reporte individual: SDD con Spec Kit — GymAccess

| Campo | Mi respuesta |
|---|---|
| **Alumno** | Noemi Tolentino Cabrera |
| **Equipo y proyecto** | Equipo GymAccess (7 integrantes) · GymAccess: control de acceso por reconocimiento facial y gestión de membresías para el Gimnasio Vida Fitness. Mi rol: Product Architect & Builder |
| **Enlace al repositorio** | https://github.com/Noemi486/gymaccess |
| **Nombre de la rama con todo el proceso** | [`feature/sprint-2`](https://github.com/Noemi486/gymaccess/tree/feature/sprint-2) |
| **Agente o herramienta de IA que usé** | Claude Code (Claude, de Anthropic) en VS Code, con GitHub Spec Kit (`specify-cli`, integración `claude`, scripts PowerShell) |

> La rama `feature/sprint-2` contiene todo el historial, desde la constitution (commit `b129cf8`) hasta la implementación más reciente. El historial no tiene squash ni force-push: cada corrección se hizo con un commit nuevo. Historial completo: https://github.com/Noemi486/gymaccess/commits/feature/sprint-2

---

## Apartado 0 — Índice de evidencias

La funcionalidad principal de este reporte es **003 — Membresías, pagos, reconocimiento facial y control de acceso** (Sprint 2), porque es la que completa el MVP. También se citan la 001 (Sprint 1, base del sistema) y la 002 (rediseño de interfaz).

| Apartado | Evidencia en la rama (archivo o commit) |
|---|---|
| Rama y repositorio | [`feature/sprint-2`](https://github.com/Noemi486/gymaccess/tree/feature/sprint-2) · [historial de commits](https://github.com/Noemi486/gymaccess/commits/feature/sprint-2) |
| 1. Constitution | [`.specify/memory/constitution.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/.specify/memory/constitution.md) · creada en [`b129cf8`](https://github.com/Noemi486/gymaccess/commit/b129cf8) |
| 2. Spec | [`specs/003-membresias-pagos-acceso/spec.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/spec.md) · creado en [`5fd6cd8`](https://github.com/Noemi486/gymaccess/commit/5fd6cd8) · ajustado en [`7c4bc53`](https://github.com/Noemi486/gymaccess/commit/7c4bc53) |
| 3. Plan técnico | [`plan.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/plan.md) · [`research.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/research.md) · [`contracts/`](https://github.com/Noemi486/gymaccess/tree/feature/sprint-2/specs/003-membresias-pagos-acceso/contracts) · commit [`7c4bc53`](https://github.com/Noemi486/gymaccess/commit/7c4bc53) |
| 4. Base de datos | [`data-model.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/data-model.md) · [`01_esquema_sprint1.sql`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/database/migrations/01_esquema_sprint1.sql) · [`02_esquema_sprint2.sql`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/database/migrations/02_esquema_sprint2.sql) · commit [`b129cf8`](https://github.com/Noemi486/gymaccess/commit/b129cf8) |
| 5. Tareas | [`tasks.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/tasks.md) · creado en [`3e24615`](https://github.com/Noemi486/gymaccess/commit/3e24615) y marcado en cada fase (`fb8fc3c` a `5631a37`) |
| 6. Implementación y verificación | Commits [`fb8fc3c`](https://github.com/Noemi486/gymaccess/commit/fb8fc3c), [`5c0303c`](https://github.com/Noemi486/gymaccess/commit/5c0303c), [`6c4c337`](https://github.com/Noemi486/gymaccess/commit/6c4c337), [`881770e`](https://github.com/Noemi486/gymaccess/commit/881770e), [`f00b6ce`](https://github.com/Noemi486/gymaccess/commit/f00b6ce), [`5631a37`](https://github.com/Noemi486/gymaccess/commit/5631a37) · pruebas en [`backend/tests/`](https://github.com/Noemi486/gymaccess/tree/feature/sprint-2/backend/tests) y [`frontend/tests/`](https://github.com/Noemi486/gymaccess/tree/feature/sprint-2/frontend/tests) · capturas en [`docs/evidencias/`](https://github.com/Noemi486/gymaccess/tree/feature/sprint-2/docs/evidencias) |
| 7. EARS (bono) | Criterios de US-S1-01 reescritos en EARS en [`c60a6fa`](https://github.com/Noemi486/gymaccess/commit/c60a6fa) ([`specs/001-base-usuarios-clientes/spec.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/001-base-usuarios-clientes/spec.md)) |

---

## Apartado 1 — Contexto y constitution

### El proyecto

Los gimnasios pequeños y medianos controlan la entrada y las mensualidades a mano. Eso deja entrar a personas con la membresía vencida, provoca pérdidas de dinero y genera filas en recepción en horas pico. **GymAccess** es un sistema web que registra clientes, planes, membresías y pagos, y controla la entrada con **reconocimiento facial**: la puerta solo se abre a clientes con su membresía **vigente y pagada**, y cada intento queda registrado.

**Para quién:** el dueño o administrador del gimnasio (control financiero y reportes), la recepcionista (altas, cobros y registro de rostros), el entrenador (consulta de clientes) y los clientes (entran con su rostro y consultan su información).

### Principios de la constitution y por qué los elegí

Archivo: [`.specify/memory/constitution.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/.specify/memory/constitution.md) (versión 1.1.1, 11 principios), generado con `/speckit-constitution` a partir de mis reglas en [`docs/reglas.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/docs/reglas.md) y [`docs/project-context.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/docs/project-context.md).

| Tema | Regla que no se negocia | Por qué la elegí |
|---|---|---|
| **Alcance (I)** | Solo se construye lo del MVP y en el orden de los sprints; toda funcionalidad debe trazarse a un requisito y una historia. | Con 7 integrantes y un semestre, el riesgo principal es que el proyecto crezca sin control. |
| **Arquitectura (II)** | `frontend/`, `backend/` y `database/` separados; backend en capas (rutas → controladores → servicios → modelos); reconocimiento facial y control de acceso como módulos independientes. | Permite que cada integrante trabaje en una parte sin romper las demás y facilita las pruebas. |
| **Stack (III)** | React + JavaScript, Node.js + Express con **ES Modules**, MySQL local, API REST, JWT y bcrypt. Toda dependencia nueva se justifica. | Es el stack que el equipo conoce, todo en JavaScript; ES Modules evita mezclar estilos de código. |
| **Base de datos (IV)** | Esquema en scripts SQL versionados; bajas lógicas (`estado`), nunca `DELETE`; el backend usa el usuario `gymaccess_app` solo con SELECT, INSERT y UPDATE. | El historial financiero y de accesos no puede perderse; quitar el permiso DELETE lo garantiza desde la base, no solo desde el código. |
| **Seguridad (V)** | Contraseñas con bcrypt; secretos solo en `.env` (nunca en Git); permisos validados en el servidor; datos faciales protegidos. | El sistema maneja datos personales, financieros y **biométricos**. Ocultar un botón no es seguridad. |
| **Reglas de negocio (VII)** | Cliente antes que membresía; pago ligado a cliente y membresía; todo intento de acceso se registra con su motivo. | Son las reglas que hacen confiable el control de acceso, que es el objetivo del acta. |
| **Reconocimiento facial (VIII)** | Solo para identificar clientes en la entrada, nunca para vigilancia; se valida la membresía antes de autorizar. | Limita el uso de datos biométricos al propósito declarado. |
| **API (IX)** | JSON, códigos HTTP correctos, middlewares de autenticación y autorización, errores centralizados sin detalles internos. | Una API consistente evita errores entre frontend y backend. |
| **Pruebas (X)** | Las funciones principales se prueban antes de darse por terminadas y de extremo a extremo; las pruebas usan solo la base `gymaccess_test`. | Una pantalla que “se ve” no significa que funcione. La base de pruebas aparte evita ensuciar los datos reales (me pasó en el Sprint 1 y lo corregí). |
| **Estilo y UX (XI)** | Interfaz consistente, confirmación antes de bajas, mensajes de éxito o error, estados con color **y** texto. | La usará personal de recepción que necesita rapidez y claridad. |

**Commit de creación:** [`b129cf8`](https://github.com/Noemi486/gymaccess/commit/b129cf8) (Sprint 1). En ese mismo trabajo la ajusté de la versión 1.0 a la **1.1.1**: cambié MongoDB por **MySQL**, fijé las carpetas `frontend/`, `backend/` y `database/` y agregué la sección “Decisiones ya tomadas” (8 tablas y usuario `gymaccess_app`).

---

## Apartado 2 — Spec

Archivo: [`specs/003-membresias-pagos-acceso/spec.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/spec.md), creado con `/speckit-specify` a partir de mi insumo [`docs/sprint-2.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/docs/sprint-2.md) y aclarado con `/speckit-clarify`. El spec no habla de tecnología: describe qué se construye y para quién.

**Contenido:**
- **11 historias de usuario con prioridad**: P1 = tipos de membresía, asignar y renovar membresías, pago completo, registrar rostro y **Estación de acceso**; P2 = consultas de accesos, pagos y adeudos, Dashboard, Inicio por rol y menú; P3 = auditoría. Cada historia tiene su *prueba independiente* y escenarios de aceptación *Given / When / Then*.
- **53 requisitos funcionales** (FR-001 a FR-053), agrupados por módulo.
- **18 casos límite**, por ejemplo: dos recepcionistas cobran la misma membresía a la vez; dos clientes se parecen y el sistema duda; hay varios rostros frente a la cámara; alguien muestra una fotografía; la membresía vence hoy.
- **15 criterios de éxito medibles** (SC-001 a SC-015), por ejemplo “resultado de la estación en menos de 3 s”, “0 accesos indebidos” y “100 % de los intentos registrados con su motivo”.

### Ambigüedades que resolví con `/speckit-clarify` (sesión 2026-10-14)

| Pregunta | Respuesta | Cómo cambió el spec |
|---|---|---|
| ¿Cuántas renovaciones por adelantado puede tener un cliente? | Solo una; mientras exista no se puede renovar otra vez. | Se agregó a FR-010 y FR-011 y al escenario de renovación. |
| ¿Qué muestra la estación al rechazar? | El nombre del cliente identificado y el motivo exacto. | Se agregó a FR-031. |
| ¿Desactivar un rostro lo borra? | No: se marca inactivo y se conserva protegido; el administrador puede reactivarlo. | Se agregó a FR-024 y al caso límite de bajas. |
| ¿Qué pasa si varias personas seguidas no son reconocidas? | Se registra cada intento y la estación se pausa 30 s con un mensaje de ayuda. | Nuevo requisito FR-053 y criterio SC-015. |

Durante el plan ajusté el spec otra vez (commit [`7c4bc53`](https://github.com/Noemi486/gymaccess/commit/7c4bc53)): los intentos fallidos pasaron de 5 a **3** con el mensaje “No te reconocemos. Pide ayuda en recepción”, “pendiente de pago” se **deriva** sin migraciones y los planes deben tener precio mayor a 0.

**Commits donde cambió el spec:** [`5fd6cd8`](https://github.com/Noemi486/gymaccess/commit/5fd6cd8) (creación y aclaraciones) → [`7c4bc53`](https://github.com/Noemi486/gymaccess/commit/7c4bc53) (ajustes del plan). Historial del archivo: https://github.com/Noemi486/gymaccess/commits/feature/sprint-2/specs/003-membresias-pagos-acceso/spec.md

---

## Apartado 3 — Plan técnico

Archivos: [`plan.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/plan.md), [`research.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/research.md) (14 decisiones), [`contracts/api-sprint2.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/contracts/api-sprint2.md) y [`contracts/ui-sprint2.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/contracts/ui-sprint2.md). Generados con `/speckit-plan` en el commit [`7c4bc53`](https://github.com/Noemi486/gymaccess/commit/7c4bc53).

**Arquitectura:** aplicación web en tres partes. El **frontend** (React 18 + Vite) captura la cámara y genera el descriptor facial; el **backend** (Node.js + Express 5, ES Modules) decide el acceso y aplica las reglas; **MySQL** guarda los datos. El backend sigue rutas → controladores → servicios → modelos, y `rostros.service` (reconocimiento) y `accesos.service` (control de acceso) son módulos separados, como exige el principio II.

**Decisiones técnicas y alternativas descartadas** (de `research.md`):

| Decisión | Por qué | Alternativas descartadas |
|---|---|---|
| **R1.** “Pendiente de pago” se deriva (membresía sin pago registrado); sin migraciones | El esquema ya existía; derivar el dato evita que “pagada” se desincronice | Columna `precio_acordado` o nuevo valor en el ENUM (ambas exigían migración) |
| **R2.** Biblioteca `@vladmandic/face-api` 1.7.15 | Licencia MIT, sin dependencias, funciona 100 % en el navegador con React/Vite | `face-api.js` original (sin mantenimiento desde 2020); `face-landmarks-detection` (no identifica personas); procesar en el backend (módulos nativos) |
| **R3.** El rostro se procesa en el navegador y **solo viaja el descriptor de 128 números**; nunca fotos | Privacidad y menor tráfico | Enviar fotos al backend; un servicio aparte |
| **R4.** El **backend** compara (distancia euclidiana, umbral 0,5) y decide | Un navegador modificado no puede autorizarse solo | Comparar en SQL (los datos van cifrados); comparar en el navegador (expondría datos biométricos) |
| **R5.** Descriptores cifrados con **AES-256-GCM** (`node:crypto`) y `FACE_KEY` | Sin dependencias; GCM detecta manipulación | AES-CBC sin autenticación; cifrado de MySQL (la clave quedaría en la base); guardar en claro |
| **R6.** Un rostro activo por cliente, garantizado con transacción (`SELECT … FOR UPDATE`) | MySQL no tiene índice único parcial | Índice único parcial (no existe en MySQL) |
| **R7.** 3 rechazos seguidos → mensaje de ayuda y pausa de 30 s | Equilibrio entre seguridad y comodidad | 5 intentos (decisión inicial del clarify) |
| **R8.** Detección de vida fuera de alcance | Complejidad alta para el sprint | Se documenta como limitación conocida |

**Coherencia con la constitution y el spec:** el plan incluye un *Constitution Check* con los 11 principios y el resultado **APROBADO** antes y después del diseño. Solo agrega **1 dependencia nueva** (en el frontend, justificada en R2 y R9, principio III), no crea tablas (FR-048), mantiene la decisión de acceso en el servidor (FR-003) y nunca expone datos faciales (FR-023, principio V).

---

## Apartado 4 — Base de datos

Archivos: [`data-model.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/data-model.md) y los esquemas reales [`01_esquema_sprint1.sql`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/database/migrations/01_esquema_sprint1.sql) y [`02_esquema_sprint2.sql`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/database/migrations/02_esquema_sprint2.sql), agregados al repositorio en [`b129cf8`](https://github.com/Noemi486/gymaccess/commit/b129cf8). Yo diseñé el modelo (mi rol de Product Architect) y lo ejecuté en MySQL 9.6 local: base `gymaccess`, InnoDB, utf8mb4, 8 tablas.

```text
clientes 1───* membresias *───1 tipos_membresia
   │  1           │ 1
   │              └───0..1 pagos *───0..1 usuarios (quien cobró)
   ├───* pagos
   ├───0..1 usuarios (cuenta del cliente)
   ├───* rostros
   └───* accesos           auditoria *───0..1 usuarios
```

| Entidad (tabla) | Campos principales y tipos | Restricciones | Requisito al que responde |
|---|---|---|---|
| `clientes` | `id_cliente` INT PK, `nombre`/`apellido` VARCHAR(80), `telefono` VARCHAR(20), `correo` VARCHAR(150) NULL, `estado` ENUM(activo, inactivo) | Nombre, apellido y teléfono obligatorios (CHECK); correo UNIQUE; baja lógica | Sprint 1: registrar clientes · FR-009 (solo clientes activos reciben membresía) |
| `usuarios` | `id_usuario` PK, `correo` UNIQUE, `password` VARCHAR(100) (hash bcrypt), `rol` ENUM(4 roles), `id_cliente` FK NULL | CHECK: rol cliente ⇔ tiene `id_cliente` | Autenticación y roles · FR-003 (permisos en el servidor) |
| `tipos_membresia` | `nombre` UNIQUE, `duracion` INT (días), `precio` DECIMAL(10,2), `estado` | CHECK duración > 0 y precio ≥ 0 (el servicio exige > 0) | FR-005 a FR-008 (planes) |
| `membresias` | `id_cliente` FK, `id_tipo_membresia` FK, `fecha_inicio`/`fecha_fin` DATE, `estado` ENUM(activa, vencida, suspendida, cancelada) | CHECK `fecha_fin ≥ fecha_inicio`; FK con RESTRICT; índice (cliente, estado, fecha_fin) | FR-009 a FR-015 (asignar, renovar, estado derivado) |
| `pagos` | `id_cliente` FK, `id_membresia` FK **NOT NULL**, `monto` DECIMAL(10,2), `metodo_pago` ENUM(efectivo, tarjeta, transferencia), `estado`, `id_usuario` FK | CHECK `monto > 0`; nunca se borran | FR-016 a FR-019 (pago completo e inmutable) · RN-05 |
| `rostros` | `id_cliente` FK, `descriptor_facial` BLOB (cifrado), `estado` | Un activo por cliente (en el servicio, R6) | FR-022 a FR-024 (rostro protegido, sin fotos) |
| `accesos` | `id_cliente` FK NULL, `fecha_hora`, `tipo` ENUM(entrada, salida), `resultado`, `motivo_rechazo` | CHECK: rechazado ⇒ tiene motivo; autorizado ⇒ tiene cliente | FR-027 a FR-033 (todo intento registrado con motivo) |
| `auditoria` | `id_usuario` FK, `accion`, `modulo`, `fecha_hora`, `resultado`, `descripcion` | Solo INSERT (inmutable) | FR-045 y FR-046 |

Además, `data-model.md` define el **estado efectivo** de una membresía (pendiente de pago, vigente, por vencer, vencida, suspendida o cancelada), que se **calcula** con el estado guardado, las fechas y el pago, sin guardarse (FR-012 y FR-048).

---

## Apartado 5 — Tareas

Archivo: [`specs/003-membresias-pagos-acceso/tasks.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/003-membresias-pagos-acceso/tasks.md), generado con `/speckit-tasks` en [`3e24615`](https://github.com/Noemi486/gymaccess/commit/3e24615). Tiene **89 tareas** en 14 fases, una fase por historia de usuario. Cada tarea indica el archivo exacto, lleva `[P]` si puede hacerse en paralelo y la etiqueta de su historia (`[US1]`…`[US11]`), lo que la liga al spec.

**Orden y dependencias** (sección *Dependencies & Execution Order*): Setup → Foundational (bloquea todo) → US1 (planes) → US2 (membresías, necesita planes) → US3 (pagos, necesita membresías) → US4 (rostro) → US5 (estación, necesita US2, US3 y US4) → consultas, Dashboard e Inicio → Polish. Dentro de cada historia: pruebas → validador → modelo → servicio → rutas → pantalla → `npm test`.

**Avance actual: 52 de 89 tareas marcadas [X]**

| Fase | Tareas | Estado |
|---|---|---|
| 1. Setup | T001–T005 | ✅ 5/5 |
| 2. Foundational (cifrado, distancia facial, auditoría, utilidades) | T006–T019 | ✅ 14/14 |
| 3. US1 Tipos de membresía | T020–T028 | ✅ 9/9 |
| 4. US2 Asignar, renovar y administrar membresías | T029–T036 | ✅ 8/8 |
| 5. US3 Pago completo | T037–T043 | ✅ 7/7 |
| 6. US4 Registro de rostro | T044–T052 | ✅ 9/9 |
| 7. US5 Estación de acceso | T053–T061 | ⏳ 0/9 |
| 8–14. Accesos, Pagos/Adeudos, Dashboard, Inicio, Menú, Auditoría, Polish | T062–T089 | ⏳ 0/28 |

Cada tarea se puede comprobar por separado: cada fase termina con un **Independent Test** y un **Checkpoint**. Por ejemplo, la fase 5: “pagar una membresía pendiente (pasa a vigente y sale de Adeudos), rechazar un monto distinto y un segundo pago”.

---

## Apartado 6 — Implementación y verificación

Implementé con `/speckit-implement` **por fases**: al terminar cada fase, Claude Code ejecutaba las pruebas y se detenía. Yo revisaba la pantalla en el navegador y después se hacía un commit por fase.

### Commits que implementan cada fase

| Commit | Tareas | Qué implementa |
|---|---|---|
| [`fb8fc3c`](https://github.com/Noemi486/gymaccess/commit/fb8fc3c) | T001–T005 | Dependencia face-api con versión exacta, modelos faciales locales y `FACE_KEY` en los `.env.example` |
| [`5c0303c`](https://github.com/Noemi486/gymaccess/commit/5c0303c) | T006–T019 | Utilidades: estado de membresía, dinero, cifrado AES-256-GCM, distancia facial, limitador y auditoría, con pruebas unitarias |
| [`6c4c337`](https://github.com/Noemi486/gymaccess/commit/6c4c337) | T020–T028 | US1: API y pantalla de Tipos de membresía, menú y pruebas |
| [`881770e`](https://github.com/Noemi486/gymaccess/commit/881770e) | T029–T036 | US2: asignar, renovar, suspender, reactivar y cancelar membresías desde el detalle del cliente |
| [`f00b6ce`](https://github.com/Noemi486/gymaccess/commit/f00b6ce) | T037–T043 | US3: registrar el pago completo (API, diálogo de pago y cobro al asignar o renovar) |
| [`5631a37`](https://github.com/Noemi486/gymaccess/commit/5631a37) | T044–T052 | US4: registro de rostro con la cámara (API cifrada, captura y panel en el detalle del cliente) |

Antes del Sprint 2 están el Sprint 1 ([`b129cf8`](https://github.com/Noemi486/gymaccess/commit/b129cf8)) y el rediseño de interfaz (de [`427b388`](https://github.com/Noemi486/gymaccess/commit/427b388) a [`0dbbc30`](https://github.com/Noemi486/gymaccess/commit/0dbbc30)).

### Verificación contra los criterios del spec

| Criterio del spec | Cómo lo comprobé | Evidencia | ¿Cumple? |
|---|---|---|---|
| US1-1: crear un plan con duración y precio > 0 | Prueba automática y en navegador (creé Semanal, Mensual, Trimestral, Anual y Premium) | [`tipos-membresia.test.js`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/backend/tests/integration/tipos-membresia.test.js), [`tipos-membresia.test.jsx`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/frontend/tests/tipos-membresia.test.jsx), captura [`tipos-membresia.png`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/docs/evidencias/tipos-membresia.png) | ✅ Sí |
| US1-4 y US1-7: nombre repetido o precio 0 se rechazan | Prueba automática y en navegador | Mismos archivos | ✅ Sí |
| US1-5 y US1-6: el recepcionista solo consulta; entrenador y cliente reciben “Sin permiso” | Pruebas de permisos por rol (403) | `tipos-membresia.test.js` | ✅ Sí |
| US2: asignar queda “pendiente de pago”; renovar solo una vez por adelantado; solo el administrador suspende o cancela | Pruebas automáticas y en navegador | [`membresias.test.js`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/backend/tests/integration/membresias.test.js), [`panel-membresia.test.jsx`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/frontend/tests/panel-membresia.test.jsx) | ✅ Sí |
| US3 y FR-017: pago completo, sin pagos parciales ni dobles | Pruebas automáticas, incluida una de **3 pagos simultáneos** | [`pagos.test.js`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/backend/tests/integration/pagos.test.js), [`registrar-pago.test.jsx`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/frontend/tests/registrar-pago.test.jsx) | ✅ Sí (ver error encontrado) |
| FR-019: los pagos no se editan ni se borran | PUT, PATCH y DELETE sobre `/pagos` responden 404 | `pagos.test.js` | ✅ Sí |
| US4 y FR-023: se guarda solo el descriptor cifrado; ninguna respuesta lo expone | Pruebas de cifrado, validación del descriptor y serializadores | [`rostros.test.js`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/backend/tests/integration/rostros.test.js), [`cifrado-facial.test.js`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/backend/tests/unit/cifrado-facial.test.js), [`serializadores-sprint2.test.js`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/backend/tests/unit/serializadores-sprint2.test.js) | ✅ Sí |
| US2, US3 y US4 de extremo a extremo: membresía asignada, pagada y vigente, y rostro registrado con la cámara real | Prueba manual en el navegador (17 oct 2026): membresía Trimestral vigente (17 oct 2026 – 14 ene 2027, 89 días restantes, $1,200.00) y “Rostro registrado el 17 oct 2026” | [`registrar-rostro.test.jsx`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/frontend/tests/registrar-rostro.test.jsx) + captura [`rostro.png`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/docs/evidencias/rostro.png) | ✅ Sí |
| SC-014: todas las pruebas pasan, incluidas las de sprints anteriores | `npm test` en backend y frontend sobre `gymaccess_test` (17 de octubre de 2026) | Backend: **395 pruebas, 394 pasan, 0 fallan, 1 omitida** ([`pruebas-backend.png`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/docs/evidencias/pruebas-backend.png)) · Frontend: **19 archivos, 235 pruebas, todas pasan** ([`pruebas-frontend.png`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/docs/evidencias/pruebas-frontend.png)) | ✅ Sí |

**Error real que encontraron las pruebas:** en la fase 5, al probar **tres pagos simultáneos de la misma membresía, se aceptaban los tres**. Una lectura dentro de la transacción veía datos viejos antes de esperar el bloqueo. Se corrigió en pagos, renovaciones y cambios de estado, y ahora se acepta solo uno (201) y los demás reciben 409. Así se cumple el caso límite “dos personas cobran la misma membresía a la vez”.

### Lo que todavía no cumple (honestamente)

- **La Estación de acceso (US5, fase 7) aún no está implementada.** Es la que cumple el criterio de aceptación del acta: “abrir el acceso solo a clientes con pago vigente, rechazar vencidos o no registrados y registrar cada intento”. Por eso los criterios SC-003, SC-004, SC-005, SC-006 y SC-015 **todavía no se pueden verificar**. Es lo siguiente en el plan.
- **Faltan 37 de 89 tareas:** consulta de accesos, pantallas de Pagos y Adeudos, Dashboard, Inicio por rol con datos del Sprint 2, auditoría completa y cierre.
- **Detección de vida:** el sistema no distingue una foto de una persona real. Está documentado como limitación (R8).
- **Trazabilidad del Sprint 1:** quedó en un solo commit grande (`b129cf8`), así que ahí no se ve qué commit implementa cada tarea. En el Sprint 2 lo corregí con un commit por fase.
- **La constitution sigue sin fecha de ratificación** del equipo.

---

## Apartado 7 — EARS y reflexión

### (a) Qué es EARS, con mis palabras

EARS (*Easy Approach to Requirements Syntax*) es una forma de escribir requisitos usando frases con estructura fija, para que no queden ambiguos y se puedan probar con un sí o un no. Cada requisito dice **cuándo** aplica, **qué sistema** lo hace y **qué debe hacer**, con un dato medible. Tiene cinco patrones: **ubicuo** (“El sistema debe…”), **por evento** (“Cuando…, el sistema debe…”), **por estado** (“Mientras…, el sistema debe…”), **no deseado** (“Si…, entonces el sistema debe…”) y **opcional** (“Donde…, el sistema debe…”). Lo que más me sirvió es que me obliga a quitar palabras vagas y a poner números.

### (b) Dos requisitos de mi spec reescritos en EARS

Tomados de la historia de inicio de sesión (US-S1-01) de [`specs/001-base-usuarios-clientes/spec.md`](https://github.com/Noemi486/gymaccess/blob/feature/sprint-2/specs/001-base-usuarios-clientes/spec.md):

| | Antes | Después (EARS) |
|---|---|---|
| **1** | *Given* un usuario que ingresa una contraseña o correo incorrectos, *When* intenta iniciar sesión, *Then* se rechaza el acceso con un mensaje de error que no revela si el correo existe. | **Si** el correo o la contraseña son incorrectos, **entonces el sistema debe** rechazar el acceso con código 401 y un mensaje idéntico en ambos casos, de modo que no revele si el correo existe. *(patrón no deseado)* |
| **2** | *Given* una cuenta con 5 intentos fallidos seguidos, *When* se intenta iniciar sesión de nuevo antes de que pasen 15 minutos, *Then* se rechaza aunque la contraseña sea correcta, con un mensaje genérico de bloqueo temporal. | **Si** una cuenta acumula 5 intentos fallidos seguidos, **entonces el sistema debe** rechazar con código 423 y un mensaje genérico de bloqueo temporal todo inicio de sesión de esa cuenta durante los siguientes 15 minutos, aunque la contraseña sea correcta. *(patrón no deseado)* |

Los datos medibles (401, 423, 5 intentos, 15 minutos, 8 horas) son los reales del sistema: `LOGIN_MAX_ATTEMPTS=5`, `LOGIN_LOCK_MINUTES=15`, `JWT_EXPIRES_IN=8h` y los códigos que devuelve `auth.service.js`.

**Bono: ya apliqué EARS en mi spec real.** Reescribí los **9 criterios** de US-S1-01 con Claude Code en el commit [`c60a6fa`](https://github.com/Noemi486/gymaccess/commit/c60a6fa) (`docs(spec-001): criterios de US-S1-01 en notación EARS`). El diff muestra en rojo la versión anterior y en verde la nueva.

### (c) Dónde y cuándo lo aplicaré en el siguiente avance

En el spec **003**, en los escenarios de aceptación de la **historia 5 (Estación de acceso)** y en los requisitos FR-027 a FR-033 y FR-053, **antes de implementar la fase 7**, la semana del 19 al 23 de octubre de 2026. Es la parte más crítica del MVP, así que conviene que sus criterios sean comprobables uno por uno. Por ejemplo:

> **Si** el cliente identificado tiene su membresía vencida, **entonces el sistema debe** rechazar el acceso, mostrar su nombre y el motivo “Membresía vencida” en menos de 3 segundos y registrar el intento con ese motivo.
>
> **Cuando** se acumulen 3 rechazos “Rostro no reconocido” seguidos, **el sistema debe** mostrar “No te reconocemos. Pide ayuda en recepción” y pausar la estación 30 segundos sin registrar intentos.

### (d) Reflexión

*(Escríbela con tus palabras; esto es un ejemplo de lo que puedes decir.)*

Mi spec cambió más de lo que esperaba. Al principio puse que el correo del cliente era obligatorio y el teléfono opcional, y lo corregí al revés. También había hecho opcional la membresía en el pago y la volví obligatoria. En el Sprint 2, las preguntas de `/speckit-clarify` me hicieron decidir cosas que no había pensado, como cuántas renovaciones por adelantado se permiten o qué pasa si varias personas no son reconocidas.

Trabajar con IA me enseñó que la IA hace bien lo que está bien escrito: cuando la regla estaba clara en el spec, el código y sus pruebas salían correctos, y las pruebas hasta encontraron un error de pagos simultáneos que yo no habría visto. Pero también aprendí que tengo que revisar todo, porque la IA tomaba decisiones por su cuenta que yo tenía que aprobar o corregir, y nunca le dejé ejecutar comandos peligrosos, como borrar la base de datos o subir el `.env`.
