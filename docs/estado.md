# Estado del proyecto — GymAccess

Última actualización: 13 de octubre de 2026

## Resumen

| # | Funcionalidad | Carpeta en `specs/` | Estado |
|---|---|---|---|
| 001 | Sprint 1: autenticación, usuarios, roles y clientes | `001-base-usuarios-clientes` | ✅ Terminado |
| 002 | Rediseño de interfaz: menú lateral y sistema visual | `002-...` | ⏳ Siguiente |
| 003 | Sprint 2: membresías, pagos, reconocimiento facial y acceso (**completa el MVP**) | `003-...` | ⬜ Pendiente |
| 004 | Sprint 3: entrenadores, rutinas y dashboard (extra) | `004-...` | ⬜ Opcional |

## MVP

El MVP queda completo al terminar la funcionalidad **003 (Sprint 2)**. Criterio de aceptación del acta: en una demostración, el sistema abre el acceso solo a clientes con pago vigente, rechaza a los vencidos o no registrados y registra cada intento.

## Base de datos

- `gymaccess` (real) — 8 tablas. Usuario `gymaccess_app`: SELECT, INSERT, UPDATE.
- `gymaccess_test` (pruebas) — 8 tablas. Usuario `gymaccess_app`: además DELETE.
- Scripts originales con contraseñas: fuera del repositorio (`gymaccess-bd/`).

## Ramas de Git

- `feature/sprint-1` — Sprint 1 terminado (commit `b129cf8`).

## Pendientes del equipo

- [ ] Ratificar la constitución (fecha de ratificación).
- [ ] Aprobar decisiones técnicas propuestas: `mysql2`, Context de React, sin librería de componentes, Vitest.
- [ ] Activar GitHub Copilot para estudiantes (GitHub Education).
- [ ] Revisar el Inicio del entrenador (funcionalidad 002, interfaz):
  - Contar y mostrar como "nuevos" solo a los clientes activos (hoy el indicador "Clientes nuevos (7 días)" y la lista "Clientes nuevos" incluyen también a los inactivos).
  - Hacer las `StatCard` más compactas.
  - Completarlo con "clientes que entraron hoy" (Sprint 2) y "mis clientes asignados" y rutinas (Sprint 3). El espacio reservado está anotado en el anexo de `specs/002-interfaz-menu-lateral/spec.md`.

## Bitácora

- **2026-10-07** — Base de datos creada (8 tablas). Constitución v1.1.1. Sprint 1 implementado y probado en navegador. Commit en `feature/sprint-1`.
