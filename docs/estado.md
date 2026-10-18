# Estado del proyecto — GymAccess

Última actualización: 17 de octubre de 2026 (Sprint 2 en curso: fases 1 a 8 de 14 hechas)

## Resumen

| # | Funcionalidad | Carpeta en `specs/` | Estado |
|---|---|---|---|
| 001 | Sprint 1: autenticación, usuarios, roles y clientes | `001-base-usuarios-clientes` | ✅ Terminado |
| 002 | Rediseño de interfaz: menú lateral y sistema visual | `002-interfaz-menu-lateral` | ✅ Terminado (rama `feature/interfaz`) |
| 003 | Sprint 2: membresías, pagos, reconocimiento facial y acceso (**completa el MVP**) | `003-membresias-pagos-acceso` | 🚧 En curso: fases 1 a 8 hechas, 65 de 89 tareas (rama `feature/sprint-2`) |
| 004 | Sprint 3: entrenadores, rutinas y dashboard (extra) | `004-...` | ⬜ Opcional |

## MVP

El MVP queda completo al terminar la funcionalidad **003 (Sprint 2)**. Criterio de aceptación del acta: en una demostración, el sistema abre el acceso solo a clientes con pago vigente, rechaza a los vencidos o no registrados y registra cada intento.

## Base de datos

- `gymaccess` (real) — 8 tablas. Usuario `gymaccess_app`: SELECT, INSERT, UPDATE.
- `gymaccess_test` (pruebas) — 8 tablas. Usuario `gymaccess_app`: además DELETE.
- Scripts originales con contraseñas: fuera del repositorio (`gymaccess-bd/`).

## Ramas de Git

- `feature/sprint-1` — Sprint 1 terminado (commit `b129cf8`).
- `feature/interfaz` — Funcionalidad 002 terminada (rediseño de interfaz), integrada a `main`.
- `main` — Igual a `feature/interfaz` (commit `0dbbc30`): Sprint 1 y rediseño de interfaz.
- `feature/sprint-2` — **Rama de trabajo actual**, creada a partir de `main`. Aquí se desarrolla la funcionalidad 003 (Sprint 2). Ya tiene remoto (`origin`, GitHub) y se sube con `git push` al cerrar cada fase.

## Siguiente paso

Funcionalidad **003 — Sprint 2**, en la rama `feature/sprint-2`. Se implementa por fases con `tasks.md` y el equipo prueba cada una.

- Hecho: fases 1 a 8 (tipos de membresía, asignar/renovar, pagos, registro de rostro, estación de acceso y consulta de accesos).
- Siguiente: **Fase 9** (US7: pantallas Pagos y Adeudos). Después: Dashboard, Inicio por rol, menú, auditoría y cierre.
- Al cerrar la 003: actualizar este archivo y agregar la nota en la spec 002 (tarea T089).

## Pendientes del equipo

- [x] Recorrido manual final de la funcionalidad 002 en el navegador (revisado por el equipo el 2026-10-13: todo se ve bien).
- [x] Integrar `feature/interfaz` a `main` (hecho el 2026-10-13: `main` creada en el commit `0dbbc30`, igual a `feature/interfaz`).
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

- **2026-10-13** — Rediseño de interfaz revisado en el navegador por el equipo. `feature/interfaz` integrada a `main` (`main` no existía: se creó en el commit `0dbbc30`, idéntica a `feature/interfaz`; las ramas `feature/sprint-1` y `feature/interfaz` se conservan). Creada `feature/sprint-2` a partir de `main`, que pasa a ser la rama de trabajo. Siguiente: funcionalidad 003 (Sprint 2).

- **2026-10-15 a 2026-10-17** — Funcionalidad 003 (Sprint 2), fases 1 a 8 en `feature/sprint-2`:
  - Decisiones del equipo: el estado "pendiente de pago" se deriva (membresía sin pago registrado), sin tablas ni columnas nuevas; un solo pago por membresía por el monto completo; el cliente con adeudo no entra ("Pago pendiente").
  - Fases 1-2: utilidades, cifrado de descriptores faciales (AES-256-GCM con `FACE_KEY`), auditoría y ayudantes de prueba. Fase 3: tipos de membresía. Fase 4: asignar, renovar y administrar membresías. Fase 5: registrar pagos.
  - Fase 6: registro de rostro (reconocimiento en el navegador con `@vladmandic/face-api`; solo viaja el descriptor de 128 números, nunca fotos; se guarda cifrado y desactivar no borra).
  - Fase 7: Estación de acceso (`/estacion`, pantalla completa): `POST /api/accesos/identificar` con umbral 0,5, un solo cliente coincidente, motivos exactos de rechazo, 30 peticiones por minuto por usuario; resultado 5 s, espera de 10 s por persona y pausa de 30 s tras 3 "Rostro no reconocido" seguidos.
  - Fase 8: consulta de accesos (`GET /api/accesos` y pantalla Accesos): filtros por fecha o rango, resultado y cliente; el entrenador solo ve nombre, fecha, hora y resultado; sin editar ni eliminar.
  - Corrección: los interbloqueos al registrar rostros de clientes distintos a la vez (actualización por clave primaria en `rostro.model.js`).
  - Interfaz: login rediseñado en pantalla dividida y acento global cambiado de verde lima a naranja `#f05a24` (solo en `tokens.css`).
  - Criterios de aceptación de las historias de inicio de sesión (spec 001) y de la Estación de acceso (spec 003) reescritos en notación EARS.
  - Pruebas al cierre de la fase 8: backend sobre `gymaccess_test` y frontend en verde; `npm run build` compila. Falta probar la cámara real en navegador (la estación y el registro de rostro).
