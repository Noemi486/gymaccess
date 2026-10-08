# Implementation Plan: Base del sistema, usuarios y clientes (Sprint 1)

**Branch**: `001-base-usuarios-clientes` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-base-usuarios-clientes/spec.md`

## Summary

Construir la base del sistema web: autenticación con roles, administración de usuarios y
gestión de clientes, sobre la base de datos `gymaccess` **ya existente**. El esquema oficial es
`database/migrations/01_esquema_sprint1.sql` y `02_esquema_sprint2.sql`: este plan **no crea
tablas ni modifica las existentes**. El backend (Node.js + Express, ES Modules) se conecta con
el usuario `gymaccess_app` (solo `SELECT`, `INSERT`, `UPDATE`), por lo que todas las bajas son
lógicas. El frontend (React) consume la API REST.

Enfoque técnico (detalle en [research.md](research.md)): `mysql2` con consultas parametrizadas,
`bcryptjs`, `jsonwebtoken`, `zod` para validación y pruebas con el ejecutor integrado de Node.
Como el esquema no puede cambiar, el bloqueo por intentos fallidos se guarda en memoria del
servidor. El backend vuelve a leer estado y rol del usuario en cada petición para que la
desactivación y los cambios de rol surtan efecto de inmediato.

## Technical Context

**Language/Version**: JavaScript (ES Modules) sobre Node.js 24 (backend) y React 18 (frontend)

**Primary Dependencies**: Backend: `express`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `zod`, `cors`. Frontend: `react`, `react-dom`, `react-router-dom`, `vite`. Sin ORM, sin biblioteca de componentes, sin `dotenv` (se usa `node --env-file`).

**Storage**: MySQL local 9 (InnoDB, utf8mb4), base `gymaccess` existente; tablas usadas: `usuarios` y `clientes`. Estado de intentos fallidos de sesión en memoria del proceso.

**Testing**: `node --test` en el backend (unitarias con modelos simulados e integración con `fetch`); `vitest` + `@testing-library/react` en el frontend.

**Target Platform**: Servidor local con Node.js 24 y navegador moderno de escritorio.

**Project Type**: Aplicación web (frontend + backend + database).

**Performance Goals**: Inicio de sesión hasta el área de trabajo en menos de 10 s (SC-001); alta de usuario o cliente en menos de 2 minutos de trabajo (SC-004, SC-005). Sin metas de carga adicionales.

**Constraints**: No modificar el esquema; no ejecutar `01_esquema_sprint1.sql` sobre la base existente (contiene `DROP DATABASE`); sin `DELETE`; el frontend nunca habla con MySQL; secretos solo en variables de entorno; no instalar librería de reconocimiento facial.

**Scale/Scope**: Un solo gimnasio, decenas de usuarios del sistema y cientos o pocos miles de clientes; 3 grupos de endpoints (`auth`, `usuarios`, `clientes`) y unas 6 pantallas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución v1.1.1.

| Principio | Evaluación | Estado |
|-----------|------------|--------|
| I. Alcance y MVP | Solo autenticación, usuarios y clientes; membresías, pagos, rostros, accesos, dashboard, reportes y auditoría quedan fuera (FR-022). | ✅ Cumple |
| II. Arquitectura separada | Carpetas `frontend/`, `backend/`, `database/`; backend con `config/`, `routes/`, `controllers/`, `services/`, `models/`, `middlewares/`, `validators/`, `utils/`. Lógica de negocio en servicios. | ✅ Cumple |
| III. Stack | React + JS, Node + Express, MySQL local, ES Modules (`"type": "module"`), consultas parametrizadas, JWT, bcrypt, variables de entorno. Cada dependencia está justificada en `research.md`. | ✅ Cumple |
| IV. Base de datos | Esquema existente sin cambios; conexión con `gymaccess_app` (nunca `root`); sin borrado; el frontend no accede a MySQL; scripts con contraseñas fuera del repositorio. | ✅ Cumple |
| V. Seguridad | Sin contraseñas en texto plano; `.env` ignorado y `.env.example` presente; permisos validados en el backend; errores genéricos. | ✅ Cumple |
| VI. Roles | Matriz de permisos y de vista por campos en `data-model.md` y en el contrato. | ✅ Cumple |
| VII. Reglas de negocio | Aplican las de usuarios y clientes; las de membresías, pagos y accesos no se tocan. | ✅ Cumple |
| VIII. Reconocimiento facial | No se instala ni implementa (fuera de este sprint). | ✅ Cumple |
| IX. API y errores | JSON, códigos HTTP apropiados, middlewares de autenticación y autorización, validación previa, manejador de errores centralizado. | ✅ Cumple |
| X. Pruebas | Unitarias, de integración y de roles; escenarios de extremo a extremo en el quickstart. | ✅ Cumple |
| XI. UX/UI | Confirmación en bajas, mensajes de éxito y error, estados visibles. | ✅ Cumple |

**Resultado**: sin violaciones; la sección Complexity Tracking no aplica.

**Aprobación pendiente del equipo** (Gobernanza): estas decisiones están en la lista de
"Decisiones Pendientes" de la constitución y aquí se proponen, no se dan por definitivas:
driver de MySQL, manejo de estado en React, biblioteca de componentes, estructura de la API REST
y herramienta de pruebas.

**Re-evaluación tras el diseño (Fase 1)**: se mantiene todo en ✅. El diseño no agrega tablas, no
agrega permisos de base de datos y mantiene la lógica en `services/`.

## Project Structure

### Documentation (this feature)

```text
specs/001-base-usuarios-clientes/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── api.openapi.yaml # Fase 1
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
backend/
├── package.json                  # "type": "module"
├── .env.example
├── src/
│   ├── app.js                    # Composición de Express (sin escuchar puerto)
│   ├── server.js                 # Arranque
│   ├── config/                   # env.js, db.js (pool mysql2)
│   ├── routes/                   # auth.routes.js, usuarios.routes.js, clientes.routes.js
│   ├── controllers/              # Reciben la petición y devuelven la respuesta
│   ├── services/                 # Reglas de negocio: auth, usuarios, clientes, intentos de sesión
│   ├── models/                   # SQL parametrizado: usuario.model.js, cliente.model.js
│   ├── middlewares/              # autenticar, autorizar(roles), validar, manejadorErrores
│   ├── validators/               # Esquemas zod
│   └── utils/                    # errores de aplicación, normalización de correo, paginación
└── tests/
    ├── unit/
    └── integration/

frontend/
├── package.json
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # Rutas y protección por rol
│   ├── api/                      # Cliente fetch con token y manejo de errores
│   ├── context/                  # AuthContext
│   ├── pages/                    # Login, Clientes, ClienteForm, Usuarios, UsuarioForm, MiPerfil
│   ├── components/               # Layout, tabla, mensajes, confirmación
│   └── styles/
└── tests/

database/
├── README.md
├── migrations/                   # 01 y 02 (ya existen; no se modifican)
├── seeds/
└── scripts/
    └── crear-admin.js            # ES Module; administrador inicial desde variables de entorno

.env.example                      # Sin secretos
.gitignore                        # Incluye .env
README.md
```

**Structure Decision**: aplicación web con las tres carpetas obligatorias de la constitución
(Principio II). No se crean carpetas alternativas (`client/`, `server/`, `dataBase/`). `app.js`
se separa de `server.js` para poder probar la API sin abrir un puerto fijo.

## Complexity Tracking

Sin violaciones de la constitución: no aplica.
