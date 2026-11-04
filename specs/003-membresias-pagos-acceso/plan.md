# Implementation Plan: Membresías, pagos, reconocimiento facial y control de acceso (Sprint 2)

**Branch**: `003-membresias-pagos-acceso` (rama de trabajo `feature/sprint-2`) | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-membresias-pagos-acceso/spec.md`

## Summary

Completar el flujo principal del proyecto: planes de membresía, asignación/renovación, pago completo, registro del rostro del cliente y entrada por reconocimiento facial con validación de membresía vigente y pagada, más las pantallas de consulta (Pagos, Adeudos, Accesos), el Dashboard del administrador y los espacios del Inicio reservados en el rediseño.

Decisiones del equipo que guían el diseño ([research.md](research.md)):
- **Sin migraciones**: "pendiente de pago" se **deriva** (membresía sin pago registrado); el precio cobrado vive en `pagos.monto`.
- **Reconocimiento facial en el navegador** con `@vladmandic/face-api` (MIT): la cámara de la laptop captura, la biblioteca genera el **descriptor de 128 valores** y **solo el descriptor** viaja al backend; nunca se envían ni guardan fotos. Modelos servidos desde `frontend/public/models` (sin internet).
- **El backend decide**: compara con distancia euclidiana (umbral **0,5**), exige una coincidencia clara con un solo cliente y valida cliente activo, membresía vigente y pagada.
- **Descriptores cifrados** con AES-256-GCM (`node:crypto`) usando `FACE_KEY` del `.env`; un rostro activo por cliente.
- **Estación de acceso** en pantalla completa: tras **3** rechazos "Rostro no reconocido" seguidos muestra "No te reconocemos. Pide ayuda en recepción". Detección de vida fuera de alcance (limitación conocida).

## Technical Context

**Language/Version**: JavaScript (ES Modules). Backend en Node.js ≥ 24 con Express 5; frontend en React 18 con Vite 8.

**Primary Dependencies**: existentes (Express, mysql2, zod, jsonwebtoken, bcryptjs; React, react-router-dom 7, lucide-react, @fontsource/inter). **Nueva (solo frontend)**: `@vladmandic/face-api@1.7.15`, justificada en [research.md](research.md) R2 y R9. El backend **no** agrega dependencias (`node:crypto`).

**Storage**: MySQL local (InnoDB, utf8mb4); base `gymaccess` (real) y `gymaccess_test` (pruebas). **Sin migraciones ni tablas nuevas**; se usan `tipos_membresia`, `membresias`, `pagos`, `rostros`, `accesos` y `auditoria`.

**Testing**: backend con `node --test` sobre `gymaccess_test`; frontend con Vitest + Testing Library + jsdom. El módulo `reconocimientoFacial.js` y la cámara se simulan en las pruebas; la prueba con rostros reales es manual ([quickstart.md](quickstart.md)).

**Target Platform**: navegador moderno de escritorio (Chrome o Edge) en la laptop de la entrada con cámara web, servido desde `localhost` (la cámara exige un contexto seguro); pantallas de gestión usables en laptop y tableta.

**Project Type**: Aplicación web (`frontend/` + `backend/` + `database/`).

**Performance Goals**: resultado de la estación en < 3 s desde que el rostro está en cuadro (descriptor en el navegador ≈ 100–300 ms por fotograma en una laptop; comparación contra cientos o pocos miles de rostros en memoria, < 50 ms); Dashboard en < 3 s.

**Constraints**: nunca enviar ni guardar fotos; descriptor nunca en respuestas ni registros; `FACE_KEY` obligatoria al arrancar; solo `SELECT`, `INSERT` y `UPDATE` (bajas lógicas); pagos, accesos y auditoría inmutables; permisos validados en el servidor; textos en español; sin internet para los modelos.

**Scale/Scope**: un gimnasio (una sucursal, una estación de entrada), cientos a pocos miles de clientes; 11 historias, 6 pantallas nuevas, 4 ampliaciones (detalle de cliente e Inicios) y ~25 endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Alcance y MVP | Cumple. Todo el alcance es del Sprint 2 (MVP). Fuera: auditoría con pantalla, salida, detección de vida, reportes avanzados, rutinas. |
| II. Arquitectura separada | Cumple. Cada recurso con su ruta, controlador, servicio, modelo y validador. **Reconocimiento facial** (`rostros.service`) y **control de acceso** (`accesos.service`) son módulos distintos que se comunican por llamadas de función. El frontend nunca toca MySQL. |
| III. Stack y dependencias | Cumple con justificación: 1 dependencia nueva (`@vladmandic/face-api`, MIT, sin dependencias propias) y 0 en el backend; la librería se elige y justifica en la planificación como exige la constitución. ES Modules, consultas parametrizadas, JWT. |
| IV. Base de datos | Cumple. Tablas del Sprint 2 ya existentes; sin migraciones; sin borrado en cascada ni `DELETE`; bajas lógicas; historiales inmutables. |
| V. Seguridad | Cumple. `FACE_KEY` por variable de entorno (sin valor en `.env.example`), descriptores cifrados, permisos por rol en el servidor, datos biométricos jamás expuestos, errores sin detalles internos. |
| VI. Roles y permisos | Cumple. Matriz del spec: el recepcionista gestiona membresías/pagos/rostros; el administrador además suspende, cancela y administra planes y rostros; el entrenador sin información financiera; el cliente solo lo propio. |
| VII. Reglas de negocio | Cumple. RN-01 a RN-12 reflejadas (cliente primero; pago con cliente y membresía; historial inmutable; acceso solo con membresía vigente **y pagada**; todo intento registrado con motivo). |
| VIII. Reconocimiento y acceso | Cumple. Solo clientes registrados, identificación antes de validar, coincidencia clara con un solo cliente, rechazo ante la duda, sin vigilancia (rostro grande y cercano, sin grabar, sin imágenes). |
| IX. API y errores | Cumple. Estructura consistente, JSON, códigos HTTP, autenticación y autorización por middleware, validación con esquemas, errores centralizados. |
| X. Pruebas | Cumple y se amplía: membresías, pagos, adeudos, autenticación y roles, reconocimiento y autorización/rechazo de accesos, registro de accesos y generación del Dashboard, sobre `gymaccess_test`. |
| XI. UX/UI | Cumple. Mismos componentes, confirmaciones en bajas y cambios de estado, avisos de éxito/error, estados con color y texto, estados vacíos y de carga. |

**Resultado del gate: APROBADO.** Sin violaciones; no se requiere Complexity Tracking.

**Re-evaluación tras el diseño (Phase 1): APROBADO.** El diseño no agrega capas ni dependencias adicionales; las tensiones con el spec (precio de planes, número de intentos) se resolvieron ajustando el spec (research, "Ajustes al spec").

## Project Structure

### Documentation (this feature)

```text
specs/003-membresias-pagos-acceso/
├── plan.md                    # Este archivo
├── research.md                # Phase 0
├── data-model.md              # Phase 1
├── quickstart.md              # Phase 1
├── contracts/
│   ├── api-sprint2.md         # Phase 1: endpoints, permisos, formatos
│   └── ui-sprint2.md          # Phase 1: menú, rutas, módulo facial, pantallas
├── checklists/requirements.md
└── tasks.md                   # Phase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
backend/
├── .env.example, .env.test.example        # + FACE_KEY= (sin valor)
├── src/
│   ├── config/env.js                       # valida FACE_KEY (64 hex)
│   ├── utils/
│   │   ├── membresia.js                    # estado efectivo, días restantes, por vencer
│   │   ├── cifradoFacial.js                # AES-256-GCM del descriptor
│   │   ├── distanciaFacial.js              # distancia euclidiana y coincidencia clara
│   │   ├── dinero.js                       # DECIMAL <-> centavos
│   │   └── limitador.js                    # límite de peticiones por usuario
│   ├── models/                             # tipoMembresia, membresia, pago, rostro, acceso,
│   │                                       # auditoria, dashboard (+ ampliar resumen.model)
│   ├── services/                           # tiposMembresia, membresias, pagos, rostros (reconocimiento),
│   │                                       # accesos (control de acceso), dashboard, auditoria,
│   │                                       # miResumen (+ ampliar resumen.service)
│   ├── controllers/ · routes/ · validators/   # uno por recurso; routes/index.js los monta
│   └── ...
└── tests/
    ├── unit/                               # membresia, cifradoFacial, distanciaFacial, dinero, limitador
    └── integration/                        # tipos-membresia, membresias, pagos, adeudos, rostros,
                                            # accesos, dashboard, resumen (ampliado), mi-resumen, auditoria

frontend/
├── package.json                            # + @vladmandic/face-api (exacta)
├── public/models/                          # modelos faciales locales + LEEME.md (origen, licencia, SHA-256)
└── src/
    ├── lib/reconocimientoFacial.js         # única puerta a face-api (carga diferida)
    ├── hooks/useCamara.js
    ├── config/                             # menu.js, indicadores.js, tarjetasCliente.js (ampliados)
    ├── components/                         # CamaraFacial, PanelMembresia, PanelRostro, RegistrarRostro,
    │                                       # AsignarMembresia, RegistrarPago, tarjetas del cliente, ...
    ├── pages/                              # Dashboard, TiposMembresia, Pagos, Adeudos, Accesos,
    │                                       # EstacionAcceso (+ ampliar ClienteDetalle e Inicio)
    └── App.jsx                             # rutas nuevas (/estacion fuera del Layout)
tests/ …                                    # un archivo de pruebas por pantalla o módulo

database/                                   # sin cambios (no hay migraciones)
docs/estado.md                              # se actualiza al terminar cada fase
```

**Structure Decision**: Se mantiene la estructura web existente (`frontend/` + `backend/` + `database/`). El backend sigue la separación rutas → controladores → servicios → modelos; el reconocimiento facial (`rostros.service`) y el control de acceso (`accesos.service`) viven en servicios distintos. Todo lo biométrico del navegador queda detrás de `lib/reconocimientoFacial.js`.

## Orden de implementación sugerido (para `/speckit-tasks`)

1. **Cimientos**: `FACE_KEY` en `env.js`/`.env.example`; utilidades `membresia`, `dinero`, `cifradoFacial`, `distanciaFacial`, `limitador`; servicio de auditoría. Pruebas unitarias.
2. **Planes, membresías y pagos** (historias 1–3 y 7): backend + pantallas Tipos de membresía, Pagos, Adeudos y panel de membresía en el detalle del cliente. Probar y detenerse.
3. **Rostro y estación** (historias 4–5): modelos locales, `reconocimientoFacial.js`, `useCamara`, registro de rostro y Estación de acceso. Prueba manual con la cámara.
4. **Consultas e Inicios** (historias 6, 8–10): Accesos, Dashboard, ampliación de `GET /resumen`, resumen del cliente y menú.
5. **Auditoría y cierre** (historia 11): eventos en todas las acciones, revisión de que ninguna respuesta exponga biometría, `docs/estado.md`.

## Ampliación 2026-11-03: US12 (avisos) y US13 (respaldo)

Agregadas por el aseguramiento de calidad de SOL12345-6 y SOL12345-5. No cambian el stack ni agregan dependencias.

**US12 — Avisos (FR-054 a FR-058)**

- Backend: `models/aviso.model.js` con una sola consulta parametrizada que deriva los avisos de `membresias`, `pagos`, `clientes` y `tipos_membresia` (sin tablas nuevas). Por vencer: `estado = 'activa'`, con pago, `CURDATE()` entre inicio y fin, `DATEDIFF(fecha_fin, CURDATE()) <= 5` y sin una renovación futura pagada. Vencida: última membresía pagada (`activa`) con `fecha_fin` entre `CURDATE() - 7` y `CURDATE() - 1`, sin otra vigente ni futura pagada. Cliente `activo`. Filtro opcional por `id_cliente` para el rol cliente.
- `services/avisos.service.js`: administrador y recepcionista sin filtro; cliente con su `id_cliente` de la sesión (nunca de la petición); entrenador 403. Respuesta `{ total, avisos: [{ id_membresia, tipo: 'por_vencer'|'vencida', dias, fecha_fin, plan, cliente: { id_cliente, nombre, apellido } }] }`, `dias` negativo para vencidas; orden: vencidas primero y luego por `fecha_fin`.
- `routes/avisos.routes.js`: `GET /avisos` con `autenticar` + `autorizar('administrador','recepcionista','cliente')`.
- Frontend: `components/CampanaAvisos.jsx` en `ui/Topbar.jsx` (no se monta para el entrenador), botón con `aria-label` "Avisos (N)", panel desplegable con estado vacío "No hay avisos", insignias (`Badge`) y enlace a `/clientes/:id` para el personal. Se recarga al cambiar de ruta. `utils/formato.js` agrega `textoAviso(dias)`.
- Pruebas: `tests/integration/avisos.test.js` (casos límite 0/5/6 días y −1/−7/−8, renovación pagada y no pagada, suspendida, cancelada, pendiente, cliente inactivo, permisos, cliente solo lo suyo, conteo = lista, tiempo < 2 s) y `frontend/tests/avisos.test.jsx`.

**US13 — Respaldo (FR-059 a FR-066)**

- `backend/scripts/respaldo.js` (ES Modules, `node:child_process` y `node:fs`, sin dependencias): lee `RESPALDO_DB_USER`, `RESPALDO_DB_PASSWORD`, `RESPALDO_DIR` y `MYSQLDUMP_PATH` (opcional) de `.env`; ejecuta `mysqldump --single-transaction --no-tablespaces --routines=false gymaccess` pasando la contraseña en la variable `MYSQL_PWD` del proceso hijo (nunca en argumentos); escribe a `*.sql.parcial` y lo renombra al terminar bien; rota a 7 solo tras un éxito; anota en `respaldos.log`. La lógica vive en `src/utils/respaldo.js` con dependencias inyectadas para probarla sin MySQL real.
- `package.json`: `"respaldo": "node --env-file=.env scripts/respaldo.js"`.
- `database/scripts/crear-usuario-respaldo.sql`: `CREATE USER IF NOT EXISTS 'gymaccess_respaldo'@'localhost'` con `SELECT, SHOW VIEW, TRIGGER, LOCK TABLES` solo en `gymaccess` (no es tabla ni migración; se ejecuta una vez como root).
- `docs/respaldo.md`: crear el usuario, configurar `.env`, programar la tarea (`schtasks /Create /SC DAILY /ST 23:00 ...` y la opción "Ejecutar la tarea lo antes posible si se omitió"), comprobar y restaurar en una base de prueba.
- `.gitignore`: `*.sql.parcial`, `respaldos/`.
- Pruebas: `tests/unit/respaldo.test.js` (nombre del archivo, contraseña fuera de los argumentos, rotación a 7, fallo sin borrar ni dejar archivo parcial, bitácora sin contraseña). La restauración (SC-022) se comprueba a mano.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
