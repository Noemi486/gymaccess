# Estado del proyecto — GymAccess

Última actualización: 13 de octubre de 2026 (cierre de la funcionalidad 002)

## Resumen

| # | Funcionalidad | Carpeta en `specs/` | Estado |
|---|---|---|---|
| 001 | Sprint 1: autenticación, usuarios, roles y clientes | `001-base-usuarios-clientes` | ✅ Terminado |
| 002 | Rediseño de interfaz: menú lateral y sistema visual | `002-interfaz-menu-lateral` | ✅ Terminado (rama `feature/interfaz`) |
| 003 | Sprint 2: membresías, pagos, reconocimiento facial y acceso (**completa el MVP**) | `003-...` | ⏳ Siguiente |
| 004 | Sprint 3: entrenadores, rutinas y dashboard (extra) | `004-...` | ⬜ Opcional |

## MVP

El MVP queda completo al terminar la funcionalidad **003 (Sprint 2)**. Criterio de aceptación del acta: en una demostración, el sistema abre el acceso solo a clientes con pago vigente, rechaza a los vencidos o no registrados y registra cada intento.

## Base de datos

- `gymaccess` (real) — 8 tablas. Usuario `gymaccess_app`: SELECT, INSERT, UPDATE.
- `gymaccess_test` (pruebas) — 8 tablas. Usuario `gymaccess_app`: además DELETE.
- Scripts originales con contraseñas: fuera del repositorio (`gymaccess-bd/`).

## Ramas de Git

- `feature/sprint-1` — Sprint 1 terminado (commit `b129cf8`).
- `feature/interfaz` — Funcionalidad 002 terminada (rediseño de interfaz). Pendiente de integrar a `main`.

## Pendientes del equipo

- [ ] Recorrido manual final de la funcionalidad 002 en el navegador, con los 4 roles, siguiendo `specs/002-interfaz-menu-lateral/quickstart.md` (las pruebas automáticas pasan, pero el aspecto visual, el menú en pantallas pequeñas y los 360–1920 px solo se confirman a mano).
- [ ] Integrar `feature/interfaz` a `main` cuando el equipo la apruebe.
- [ ] Ratificar la constitución (fecha de ratificación).
- [ ] Aprobar decisiones técnicas propuestas: `mysql2`, Context de React, sin librería de componentes, Vitest.
- [ ] Activar GitHub Copilot para estudiantes (GitHub Education).
- [ ] Revisar el Inicio del entrenador (funcionalidad 002, interfaz):
  - Contar y mostrar como "nuevos" solo a los clientes activos (hoy el indicador "Clientes nuevos (7 días)" y la lista "Clientes nuevos" incluyen también a los inactivos).
  - Hacer las `StatCard` más compactas.
  - Completarlo con "clientes que entraron hoy" (Sprint 2) y "mis clientes asignados" y rutinas (Sprint 3). El espacio reservado está anotado en el anexo de `specs/002-interfaz-menu-lateral/spec.md`.

## Bitácora

- **2026-10-07** — Base de datos creada (8 tablas). Constitución v1.1.1. Sprint 1 implementado y probado en navegador. Commit en `feature/sprint-1`.

- **2026-10-13** — Funcionalidad 002 (rediseño de interfaz) terminada en `feature/interfaz`:
  - Sistema visual: tema oscuro con acento verde lima `#A3E635`, tokens de diseño en un solo archivo, fuente Inter incluida localmente (`@fontsource/inter`) e íconos `lucide-react` (dependencias aprobadas por el equipo). Sin librería de componentes.
  - Estructura: menú lateral por rol (ocultable en pantallas de menos de 1024 px), encabezado con título y menú de usuario con avatar, y componentes reutilizables en `frontend/src/components/ui/`.
  - Pantallas: login de dos paneles con carrusel de 3 diapositivas y botón para mostrar la contraseña; Inicio como panel de resumen por rol; Mi información con perfil y tarjeta "Mi cuenta"; listas y formularios de Clientes y Usuarios; páginas "No encontrado" y "Sin permiso".
  - Backend (únicos cambios, aprobados por el equipo): `GET /api/resumen` (solo lectura, por rol) y `PATCH /api/auth/password` (cambio de contraseña de cualquier usuario autenticado). Sin cambios en la base de datos.
  - Limpieza: se retiraron los componentes antiguos `Layout`, `Mensaje`, `Confirmacion` y `Paginacion` (verificado que nadie los importaba) y el CSS heredado sin uso. Contraste revisado: textos, insignias y bordes de campos cumplen 4.5:1 y 3:1 (se aclararon el texto tenue y los bordes de campos).
  - Pruebas: backend 214 pasan y 1 omitida (0 fallos) sobre `gymaccess_test`; frontend 171 pasan; `npm run build` compila.
  - Pendiente anotado: revisar el Inicio del entrenador (ver "Pendientes").
