# Implementation Plan: Entrenadores, rutinas, progreso y dashboard de entrenamiento (Sprint 3)

**Branch**: `feature/sprint-3` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

## Summary

Se agregan entrenadores (ficha + cuenta con rol entrenador), asignación cliente–entrenador con historial, rutinas versionadas con ejercicios por día, objetivos y avances con medidas, la vista "Mi entrenamiento" del cliente, la sección Entrenamiento del Dashboard, "Mis clientes asignados" en el Inicio del entrenador y el modo Salida de la Estación de acceso. Se reutilizan la arquitectura y los patrones de las specs 001 a 003 (servicios con dependencias inyectadas, SQL parametrizado, `autenticar` + `autorizar`, auditoría, componentes comunes).

## Technical Context

- **Stack**: igual que el Sprint 2 (Node 24 + Express 5 + mysql2 + zod en ES Modules; React 18 + Vite; Vitest y `node:test`). **Sin dependencias nuevas.**
- **Base de datos**: 6 tablas nuevas con `database/migrations/03_esquema_sprint3.sql` (ver [data-model.md](data-model.md)). `gymaccess_app` ya tiene permisos de base completa (SELECT, INSERT, UPDATE en `gymaccess`; además DELETE en `gymaccess_test`).
- **Integridad**: "una asignación activa" y "una rutina activa" por cliente se garantizan en la base con un índice único sobre una columna generada (`cliente_activa`), además de la validación del servicio con bloqueo de la fila del cliente (`SELECT ... FOR UPDATE`) dentro de una transacción.
- **Sin DELETE**: versionar una rutina inserta una nueva y archiva la anterior; ejercicios, objetivos, avances y asignaciones nunca se borran.
- **Rendimiento**: listas paginadas; consultas del Dashboard con agregados indexados (< 3 s, como SC-009 de la spec 003).

## Constitution Check

| Regla | Cumplimiento |
|---|---|
| Carpetas `frontend/`, `backend/`, `database/` | Sí |
| ES Modules, SQL parametrizado | Sí |
| Permisos en el backend | Cada ruta con `autenticar` + `autorizar`; la pertenencia del cliente al entrenador se valida en el servicio |
| Bajas lógicas, sin DELETE en `gymaccess` | Sí (estados y fechas) |
| Pruebas solo en `gymaccess_test` | Sí |
| No ejecutar el script 01 | El script 03 es independiente y no destructivo |
| Dependencias justificadas | Ninguna nueva |

## Project Structure

```text
database/migrations/03_esquema_sprint3.sql          # 6 tablas nuevas (no destructivo)

backend/src/
├── models/        entrenador.model.js, asignacion.model.js, rutina.model.js,
│                  objetivo.model.js, progreso.model.js (+ dashboard.model, acceso.model, resumen.model)
├── services/      entrenadores.service.js, asignaciones.service.js, entrenamiento.service.js
│                  (rutinas, objetivos, avances y permisos de entrenador), miEntrenamiento.service.js
│                  (+ usuarios.service: no desactivar entrenador con clientes; dashboard; accesos: tipo)
├── validators/    entrenador.validator.js, asignacion.validator.js, entrenamiento.validator.js
├── controllers/ · routes/   entrenadores, asignaciones (bajo /clientes/:id/entrenador), entrenamiento
└── utils/serializadores.js  (entrenadorPublico, rutinaPublica, progresoPublico...)

backend/tests/
├── unit/          entrenamiento.validator, diferencias de progreso
└── integration/   entrenadores, asignaciones, rutinas, objetivos-progresos, mi-entrenamiento,
                   dashboard-entrenamiento, salida, auditoria-sprint3, permisos-sprint3

frontend/src/
├── pages/         Entrenadores.jsx, EntrenadorDetalle.jsx, FormularioEntrenador (alta/edición),
│                  MisClientes.jsx, EntrenamientoCliente.jsx, MiEntrenamiento.jsx
├── components/    PanelEntrenador.jsx (detalle del cliente), EditorRutina.jsx, VistaRutina.jsx,
│                  ListaObjetivos.jsx, HistorialProgreso.jsx, MisClientesAsignados.jsx (Inicio)
├── config/        menu.js (+3 secciones), indicadores.js (+ mis clientes asignados)
└── pages/EstacionAcceso.jsx, pages/Accesos.jsx, pages/Dashboard.jsx (ampliados)
```

## API (contratos)

Todas bajo `/api`, JSON, errores con el formato existente `{ error: { code, message, details } }`.

| Método y ruta | Roles | Descripción |
|---|---|---|
| `GET /entrenadores?q&estado&page&limit` | A, R | Lista con `clientes_asignados` |
| `POST /entrenadores` | A | `{ nombre, correo, password, telefono?, especialidad? }` → cuenta + ficha (transacción) |
| `GET /entrenadores/:id` | A, R | Ficha + clientes asignados activos (`:id` = id_usuario) |
| `PATCH /entrenadores/:id` | A | `{ nombre?, telefono?, especialidad? }` (crea la ficha si no existía) |
| `PATCH /entrenadores/:id/estado` | A | `{ estado }`; 409 si tiene clientes asignados al desactivar |
| `GET /clientes/:id/entrenador` | A, R | `{ actual, historial }` |
| `PUT /clientes/:id/entrenador` | A, R | `{ id_entrenador }` asigna o cambia; `{ id_entrenador: null }` quita |
| `GET /entrenamiento/mis-clientes?q&page&limit` | E | Clientes asignados activos |
| `GET /clientes/:id/entrenamiento` | E (asignado), A | `{ cliente, entrenador, rutina_activa, rutinas, objetivos, progresos }` |
| `GET /rutinas/:id` | E (asignado), A | Rutina con ejercicios (activa o archivada) |
| `POST /clientes/:id/rutinas` | E (asignado) | `{ nombre, indicaciones?, dias: [{ dia, ejercicios: [...] }] }` → nueva versión activa |
| `POST /clientes/:id/objetivos` | E (asignado) | `{ descripcion, meta?, fecha_limite? }` |
| `PATCH /objetivos/:id` | E (asignado) | `{ descripcion?, meta?, fecha_limite? }` o `{ estado: 'cumplido' \| 'cancelado' }` |
| `POST /clientes/:id/progresos` | E (asignado) | `{ fecha, peso_kg?, grasa_pct?, cintura_cm?, comentario? }` |
| `PATCH /progresos/:id` | E (autor, mismo día) | Corrección |
| `GET /clientes/me/entrenamiento` | C | Lo propio, sin contacto del entrenador |
| `GET /dashboard` | A | + bloque `entrenamiento` |
| `POST /accesos/identificar` | A, R | + `tipo: 'entrada' \| 'salida'` (por defecto entrada) |
| `GET /accesos` | A, R, E | + filtro `tipo` |

## Orden de implementación

1. **Fase 1 — Cimientos**: migración 03 (el equipo la ejecuta en ambas bases), ayudantes de prueba (crear entrenador, asignar, limpiar tablas nuevas), validadores y serializadores.
2. **Fase 2 — US1 Entrenadores** (backend + pantallas Entrenadores, alta, edición, detalle; regla de desactivación también en usuarios).
3. **Fase 3 — US2 y US7 Asignaciones** (panel en el detalle del cliente, detalle del entrenador, "Mis clientes" y su indicador en el Inicio).
4. **Fase 4 — US3 Rutinas** (editor por días, versiones, historial).
5. **Fase 5 — US4 Objetivos y progreso**.
6. **Fase 6 — US5 Mi entrenamiento** (cliente).
7. **Fase 7 — US6 Dashboard de entrenamiento**.
8. **Fase 8 — US8 Salida** (estación, accesos y ajuste de las cifras del Sprint 2 a solo entradas).
9. **Fase 9 — Cierre**: auditoría, permisos, sin biometría, seguridad, `docs/estado.md`, Jira.

Detenerse al final de cada fase para que el equipo pruebe (CLAUDE.md).

## Complexity Tracking

| Decisión | Por qué |
|---|---|
| 6 tablas nuevas (el Sprint 2 no creó ninguna) | El Sprint 3 introduce datos que no existen en ninguna tabla actual (entrenadores, rutinas, progreso). `estadisticas_dashboard` sí se evita. |
| Columna generada + índice único | MySQL no tiene índices únicos parciales; así la base impide dos asignaciones o rutinas activas aunque haya peticiones simultáneas. |
