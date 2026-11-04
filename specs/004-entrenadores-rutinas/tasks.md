# Tasks: Entrenadores, rutinas, progreso y dashboard de entrenamiento (Sprint 3)

**Input**: `specs/004-entrenadores-rutinas/` (spec, plan, data-model). Pruebas solo contra `gymaccess_test`.

**Formato**: `[ID] [P?] [Historia] Descripción`. `[P]` = puede hacerse en paralelo (archivos distintos).

## Phase 1: Cimientos

- [X] T001 `database/migrations/03_esquema_sprint3.sql` (6 tablas, no destructivo) y nota en `database/scripts/crear-bd-pruebas.sql`
- [X] T002 El equipo ejecuta el script 03 en `gymaccess` y en `gymaccess_test` (manual) y confirma 14 tablas
- [X] T003 [P] `backend/tests/helpers.js`: `crearEntrenadorDePrueba`, `asignarEntrenadorDePrueba`, y `limpiarDatosDePrueba` borra (solo en `gymaccess_test`) ejercicios, rutinas, objetivos, progresos, asignaciones y fichas de los clientes y usuarios de la prueba
- [X] T004 [P] Validadores zod: `entrenador.validator.js`, `asignacion.validator.js`, `entrenamiento.validator.js` (rutina por días, objetivo, avance con rangos y "al menos un dato") + `tests/unit/entrenamiento-validator.test.js`
- [X] T005 [P] Serializadores y utilidad de diferencias de progreso (`utils/progreso.js`) con pruebas unitarias

## Phase 2: US1 Entrenadores (P1)

- [X] T006 [P] [US1] `tests/integration/entrenadores.test.js`: alta en una transacción (correo repetido no deja cuenta ni ficha), edición, lista con número de clientes, cuenta antigua sin ficha aparece, desactivar con clientes → 409 (también vía `PATCH /usuarios/:id`), permisos A/R/E/C, auditoría
- [X] T007 [US1] `models/entrenador.model.js`, `services/entrenadores.service.js`, controlador, rutas `/entrenadores`; regla de desactivación en `usuarios.service.js`
- [X] T008 [P] [US1] Frontend: menú "Entrenadores", páginas lista, alta/edición y detalle; `tests/entrenadores.test.jsx`

## Phase 3: US2 y US7 Asignaciones (P1)

- [X] T009 [P] [US2] `tests/integration/asignaciones.test.js`: asignar, cambiar (cierra la anterior), quitar, historial, rechazos (cliente inactivo o inexistente, entrenador inactivo o con otro rol), simultáneas → una sola activa, permisos, auditoría; lista del entrenador = asignaciones activas (US7)
- [X] T010 [US2] `models/asignacion.model.js`, `services/asignaciones.service.js`, rutas `GET/PUT /clientes/:id/entrenador` y `GET /entrenamiento/mis-clientes`
- [X] T011 [P] [US2] Frontend: `PanelEntrenador` en el detalle del cliente, clientes en el detalle del entrenador, página "Mis clientes" y "Mis clientes asignados" en el Inicio del entrenador; pruebas

## Phase 4: US3 Rutinas (P1)

- [X] T012 [P] [US3] `tests/integration/rutinas.test.js`: crear, versionar N veces → N+1 versiones con ejercicios intactos, validaciones, una activa con peticiones simultáneas, entrenador no asignado o anterior → 403, cliente inactivo → 409, administrador solo lectura, recepcionista 403, auditoría
- [X] T013 [US3] `models/rutina.model.js`, `services/entrenamiento.service.js` (permisos de entrenador + rutinas), rutas
- [X] T014 [P] [US3] Frontend: página `EntrenamientoCliente` con `EditorRutina` (días y ejercicios) y `VistaRutina` + historial; pruebas

## Phase 5: US4 Objetivos y progreso (P1)

- [X] T015 [P] [US4] `tests/integration/objetivos-progresos.test.js`: objetivos (crear, editar en curso, cumplir, cancelar, no editar cerrado), avances (rangos, fecha futura, al menos un dato, corrección solo autor y mismo día), orden y diferencias, permisos, auditoría sin medidas
- [X] T016 [US4] `models/objetivo.model.js`, `models/progreso.model.js`, ampliar `entrenamiento.service.js`, rutas
- [X] T017 [P] [US4] Frontend: `ListaObjetivos` y `HistorialProgreso` en `EntrenamientoCliente`; pruebas

## Phase 6: US5 Mi entrenamiento (P2)

- [ ] T018 [P] [US5] `tests/integration/mi-entrenamiento.test.js`: lo propio, sin contacto del entrenador, estados vacíos, solo rol cliente
- [ ] T019 [US5] `services/miEntrenamiento.service.js`, ruta `GET /clientes/me/entrenamiento`
- [ ] T020 [P] [US5] Frontend: menú "Mi entrenamiento" y página; pruebas

## Phase 7: US6 Dashboard de entrenamiento (P2)

- [ ] T021 [P] [US6] `tests/integration/dashboard-entrenamiento.test.js`: cada cifra contra su origen (con `soloEntrenadores` para aislar), periodo solo afecta lo del periodo, 403 a otros roles
- [ ] T022 [US6] Ampliar `dashboard.model.js` y `dashboard.service.js` con el bloque `entrenamiento`
- [ ] T023 [P] [US6] Frontend: sección "Entrenamiento" y tabla "Carga por entrenador" en `Dashboard.jsx`; pruebas

## Phase 8: US8 Salida (P3)

- [ ] T024 [P] [US8] `tests/integration/salida.test.js`: salida autorizada sin revisar membresía, salida no reconocida rechazada, filtro por tipo, y las cifras del Sprint 2 cuentan solo entradas (accesos de hoy, clientes que entraron hoy, Dashboard, últimas visitas)
- [ ] T025 [US8] Backend: `tipo` en el validador y en `accesos.service.js`; filtro `tipo` en `GET /accesos`; `tipo = 'entrada'` en las consultas de resumen, dashboard y mi resumen
- [ ] T026 [P] [US8] Frontend: selector Entrada / Salida en la estación, mensaje "Hasta luego", columna y filtro de tipo en Accesos; pruebas

## Phase 9: Cierre

- [ ] T027 [P] `tests/integration/permisos-sprint3.test.js` y `frontend/tests/permisos-sprint3.test.jsx` (matriz del Anexo), y ampliar `sin-biometria.test.js` con los endpoints nuevos
- [ ] T028 Revisión de seguridad (rutas con `autenticar` y `autorizar`, sin DELETE en código de producción, sin secretos) y de accesibilidad de las pantallas nuevas
- [ ] T029 Ejecutar todas las pruebas (SC-011) y `npm run build`
- [ ] T030 Recorrido manual del flujo demostrable del sprint con los 4 roles (equipo)
- [ ] T031 `docs/estado.md`, nota en la spec 002 ("Mis clientes asignados" activo) y Jira

## Dependencias

Fase 1 → Fase 2 → Fase 3 → (Fases 4 y 5) → Fase 6 → Fase 7; la Fase 8 solo depende de la Fase 1. Detenerse al final de cada fase para que el equipo pruebe.
