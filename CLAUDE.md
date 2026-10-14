# CLAUDE.md — GymAccess

Instrucciones para Claude en este proyecto. Responde siempre en español.

## Qué es este proyecto

GymAccess: sistema web para un gimnasio que administra clientes, membresías, pagos y el acceso mediante reconocimiento facial. Proyecto académico de Gestión de Proyectos, desarrollado con Spec Kit (Spec-Driven Development).

## Documentos de referencia (leer antes de trabajar)

| Archivo | Para qué |
|---|---|
| `.specify/memory/constitution.md` | Reglas no negociables del proyecto. Tienen prioridad. |
| `docs/project-context.md` | Contexto maestro: roles, módulos, reglas de negocio, tablas. |
| `docs/estado.md` | Avance actual del proyecto. Actualízalo al terminar cada fase. |
| `docs/sprint-*.md` | Insumos de cada sprint para `/speckit-specify`. |
| `specs/NNN-*/` | Especificación, plan y tareas de cada funcionalidad (los genera Spec Kit). |

## Estructura del proyecto

```text
gym-system/
├── docs/        Documentación del proyecto e insumos de sprints
├── specs/       Generado por Spec Kit: una carpeta por funcionalidad
├── frontend/    React + JavaScript (Vite)
├── backend/     Node.js + Express, ES Modules
├── database/    migrations/, seeds/, scripts/ de MySQL
└── CLAUDE.md
```

No crear carpetas alternativas (`client/`, `server/`, `dataBase/`).

## Reglas de trabajo

- Base de datos MySQL local `gymaccess`. **Nunca** ejecutar `database/migrations/01_esquema_sprint1.sql` (hace `DROP DATABASE`).
- El backend se conecta con `gymaccess_app` (sin DELETE en `gymaccess`). Las bajas son lógicas (`estado`).
- Las pruebas usan **solo** la base `gymaccess_test` (`backend/.env.test`). Nunca escribir datos de prueba en `gymaccess`.
- Backend con ES Modules (`import`/`export`), nunca `require`.
- Consultas SQL siempre parametrizadas.
- Permisos validados en el backend; ocultar algo en la interfaz no es seguridad.
- No subir `.env` ni `.env.test` a Git.
- No agregar dependencias sin justificarlas.
- No borrar archivos ni trabajar fuera de la carpeta del proyecto sin preguntar.
- Implementar por fases y detenerse al terminar cada una para que el equipo pruebe.

## Cómo levantar el sistema

```text
Backend:   cd backend  && npm run dev   → http://localhost:3000
Frontend:  cd frontend && npm run dev   → http://localhost:5173
Pruebas:   cd backend  && npm test
```
