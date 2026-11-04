# Estado del proyecto — GymAccess

Última actualización: 4 de noviembre de 2026 (Sprint 2 y Sprint 3 terminados; faltan los recorridos manuales T088 y T030)

## Resumen

| # | Funcionalidad | Carpeta en `specs/` | Estado |
|---|---|---|---|
| 001 | Sprint 1: autenticación, usuarios, roles y clientes | `001-base-usuarios-clientes` | ✅ Terminado |
| 002 | Rediseño de interfaz: menú lateral y sistema visual | `002-interfaz-menu-lateral` | ✅ Terminado (rama `feature/interfaz`) |
| 003 | Sprint 2: membresías, pagos, reconocimiento facial y acceso (**completa el MVP**) | `003-membresias-pagos-acceso` | ✅ Fases 1 a 16 hechas, con US12 (avisos) y US13 (respaldo) (rama `feature/sprint-2`). Falta el recorrido manual con la cámara (T088) |
| 004 | Sprint 3: entrenadores, rutinas, progreso, dashboard y salida | `004-entrenadores-rutinas` | ✅ Fases 1 a 9 (rama `feature/sprint-3`). Falta el recorrido manual con los 4 roles (T030) |

## MVP

El MVP queda completo al terminar la funcionalidad **003 (Sprint 2)**. Criterio de aceptación del acta: en una demostración, el sistema abre el acceso solo a clientes con pago vigente, rechaza a los vencidos o no registrados y registra cada intento.

## Base de datos

- `gymaccess` (real) — 8 tablas. Usuario `gymaccess_app`: SELECT, INSERT, UPDATE.
- `gymaccess_test` (pruebas) — 8 tablas. Usuario `gymaccess_app`: además DELETE.
- Usuario `gymaccess_respaldo` (solo lectura en `gymaccess`) para el respaldo diario: `npm run respaldo`, tarea de Windows "GymAccess - Respaldo diario" a las 23:00, carpeta `C:\RespaldosGymAccess`, se guardan 7. Guía: `docs/respaldo.md`.
- Scripts originales con contraseñas: fuera del repositorio (`gymaccess-bd/`).

## Ramas de Git

- `feature/sprint-1` — Sprint 1 terminado (commit `b129cf8`).
- `feature/interfaz` — Funcionalidad 002 terminada (rediseño de interfaz), integrada a `main`.
- `main` — Igual a `feature/interfaz` (commit `0dbbc30`): Sprint 1 y rediseño de interfaz.
- `feature/sprint-3` — **Rama de trabajo actual**, creada a partir de `feature/sprint-2` (incluye todo el Sprint 2). Funcionalidad 004.
- `feature/sprint-2` — Funcionalidad 003, creada a partir de `main`. Aquí se desarrolla la funcionalidad 003 (Sprint 2). Ya tiene remoto (`origin`, GitHub) y se sube con `git push` al cerrar cada fase.

## Siguiente paso

Funcionalidad **003 — Sprint 2**, en la rama `feature/sprint-2`.

- Hecho: fases 1 a 16 (tipos de membresía, asignar/renovar, pagos, registro de rostro, estación de acceso, consulta de accesos, pagos y adeudos, dashboard, Inicio por rol, menú y permisos, auditoría, cierre, avisos US12 y respaldo US13).
- Pendiente del equipo: recorrer `specs/003-membresias-pagos-acceso/quickstart.md` con la cámara real y los 4 roles (T088), y ver un aviso real en la campana con una membresía por vencer.
- Sprint 3 terminado en `feature/sprint-3` (spec `specs/004-entrenadores-rutinas/`): entrenadores, asignaciones y Mis clientes, rutinas versionadas, objetivos y progreso, Mi entrenamiento, sección Entrenamiento del Dashboard y salida del gimnasio.
- Pendiente del equipo: recorrido manual del Sprint 2 con la cámara (T088) y del Sprint 3 con los 4 roles (T030); decidir la integración de `feature/sprint-3` a `main` para la entrega.
- Decisión pendiente: la historia SOL12345-4 pide un **relevador para chapa magnética o torniquete**, que no está en ninguna spec ni se construyó (la estación solo muestra el resultado). En Jira quedó "En curso": integrarlo (requiere hardware y una spec nueva) o declararlo fuera de alcance.

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

- **2026-11-03** — Funcionalidad 003 (Sprint 2), fases 9 a 14 en `feature/sprint-2`:
  - Aseguramiento de calidad de lo pendiente con Jira conectado por MCP (Claude y Claude Code): historias SOL12345-4, -5 y -6 corregidas y SOL12345-11 a -14 creadas en la épica SOL12345-8. Decisiones: avisos dentro del sistema (US12), base local, solo entrada en este sprint (la salida pasa al Sprint 3) y respaldo automático diario (US13).
  - Fase 9: `GET /api/pagos` (historial con filtros y total) y `GET /api/adeudos`; pantallas Pagos y Adeudos.
  - Fase 10: `GET /api/dashboard` (solo administrador) con periodo hoy, semana, mes o rango; pantalla Dashboard con botón Actualizar.
  - Fase 11: Inicio de cada rol: accesos de hoy y membresías por vencer (A, R), clientes que entraron hoy (E) y las 4 tarjetas del cliente con `GET /api/clientes/me/resumen`. Tarjetas del cliente en 2 columnas (corrección tras la revisión en navegador).
  - Fase 12: matriz de permisos de las pantallas nuevas. Fase 13: pruebas de auditoría; los rechazos al registrar o cambiar un rostro ahora dejan evento de error.
  - Fase 14: revisión de seguridad (sin `.env` en Git, `FACE_KEY` sin valor en los ejemplos, sin `DELETE`, todas las rutas con `autenticar` y `autorizar`) y prueba de que ninguna respuesta ni la consola contienen datos biométricos.
  - Pruebas: las del backend corren un archivo a la vez (`--test-concurrency=1`) porque varias comparten `gymaccess_test`; antes fallaban de forma intermitente. Backend 469 pasan y 1 omitida (0 fallos); frontend 341 pasan.

- **2026-11-03 (noche)** — US12 y US13 agregadas a la spec 003 (FR-054 a FR-066, SC-016 a SC-022) y construidas:
  - Fase 15 (US12): `GET /api/avisos` derivado de membresías y pagos, sin tablas nuevas (por vencer: 5 días o menos; vencidas: hace 7 días o menos sin una nueva vigente); campana en el encabezado para administrador, recepcionista y cliente; el entrenador no la ve (403). Probada en navegador ("No hay avisos", coincide con "Membresías por vencer: 0").
  - Fase 16 (US13): `npm run respaldo` con `mysqldump` y el usuario de solo lectura `gymaccess_respaldo` (contraseña en un archivo de opciones temporal, nunca en la línea de comandos); se escribe a `.parcial` y solo se renombra si terminó bien; rotación a 7; bitácora `respaldos.log` sin secretos. Tarea de Windows registrada (`backend/scripts/respaldo.cmd`, 23:00, se ejecuta al encender si se omitió); su salida queda en `backend/respaldo-tarea.log`.
  - Comprobación manual (T100): respaldo a mano y desde la tarea correctos (25 514 bytes); restauración en `gymaccess_restaurada` con cantidades iguales a la original: 9 clientes, 7 pagos y 42 accesos (SC-022); la base de prueba se eliminó después.
  - Pruebas: backend 481 pasan y 1 omitida (0 fallos); frontend 349 pasan; pruebas unitarias del respaldo 8 de 8.

- **2026-11-03/04 (noche)** — Sprint 3 iniciado en `feature/sprint-3`:
  - Aseguramiento de calidad: spec 004 con 4 aclaraciones del equipo (alta de entrenador en un solo formulario; objetivos y avances con medidas; una rutina activa por día con historial; salida sencilla) y decisiones del análisis (modificar = nueva versión, sin DELETE; avance corregible solo el mismo día; sin tabla `estadisticas_dashboard`).
  - Migración `database/migrations/03_esquema_sprint3.sql` (6 tablas, no destructiva) ejecutada en `gymaccess_test` (14 tablas).
  - Fase 2: entrenadores (alta en transacción, edición, baja bloqueada con clientes asignados también desde Usuarios). Fase 3: asignación de entrenador, Mis clientes e indicador del Inicio del entrenador. Fase 4: rutinas versionadas con editor por días.
  - Pruebas al cierre de la fase 3: backend 517 pasan y 1 omitida (0 fallos); frontend 373 pasan. Espera común de 4 s en las pruebas del frontend (`tests/setup.js`).

- **2026-11-04** — Sprint 3, fases 5 a 9 en `feature/sprint-3`:
  - Fase 5: objetivos (crear, editar en curso, cumplir, cancelar) y avances con peso, grasa y cintura (rangos, sin fechas futuras, corrección solo del autor el mismo día, diferencias con el avance anterior).
  - Fase 6: "Mi entrenamiento" del cliente (solo lectura, por sesión, sin contacto del entrenador).
  - Fase 7: sección Entrenamiento del Dashboard (7 cifras y carga por entrenador; con + sin entrenador = clientes activos).
  - Fase 8: modo Entrada / Salida en la estación (probado con la cámara real: "Hasta luego, Prueba 1"); filtro de tipo en Accesos; las cifras del Sprint 2 cuentan solo entradas.
  - Fase 9: matriz de permisos del sprint (backend y frontend), sin biometría en los endpoints nuevos y revisión de seguridad (todas las rutas con `autenticar` y `autorizar`; sin DELETE en el código; sin secretos en Git).
  - Pruebas al cierre de la fase 8: backend 543 pasan y 1 omitida (0 fallos); frontend 403 pasan.
  - Jira: épica SOL12345-15 (Sprint 3) con 8 historias (SOL12345-16 a -23) en Finalizada con su evidencia; las historias del Sprint 2 ya terminadas (-3, -6, -7, -11, -12, -13) pasadas a Finalizada con comentario de evidencia; SOL12345-4 en "En curso" por el relevador.
  - Pruebas finales (T029): backend 546 pasan y 1 omitida (0 fallos) sobre `gymaccess_test`; frontend 433 pasan (33 archivos); `npm run build` compila.
