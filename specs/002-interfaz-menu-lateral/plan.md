# Implementation Plan: Rediseño de interfaz: menú lateral y sistema visual

**Branch**: `002-interfaz-menu-lateral` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-interfaz-menu-lateral/spec.md`

## Summary

Reemplazar el marco visual del frontend (hoy un encabezado con enlaces sueltos y una hoja de estilos con colores propios) por una estructura común con **menú lateral por rol**, **encabezado con la sesión** y un **conjunto de componentes reutilizables** (`frontend/src/components/ui/`) con **tokens de diseño** en variables CSS. El menú se genera desde un único archivo de configuración (sección, ícono, ruta, roles, bloque). Se rediseñan las pantallas de Sprint 1 y se agregan las páginas "No encontrado" y "Sin permiso". No cambia el backend, la API ni la base de datos. Única dependencia nueva propuesta: una librería ligera de íconos (`lucide-react`).

## Technical Context

**Language/Version**: JavaScript (ES Modules), React 18.3, Node.js (el existente del proyecto)

**Primary Dependencies**: React, react-router-dom 7 (existentes); **nuevas**: `lucide-react` (íconos) y `@fontsource/inter` (fuente local), justificadas en [research.md](research.md)

**Storage**: N/A (sin cambios; solo se usa `localStorage` si se decide recordar el estado del menú, ver research.md)

**Testing**: Vitest + Testing Library + jsdom (existentes, `frontend/tests/`); `npm test` en `frontend/` y `backend/`

**Target Platform**: Navegadores modernos de escritorio, laptop pequeña y tableta (≥ 360 px de ancho)

**Project Type**: Aplicación web (frontend React + backend Express); este cambio solo toca `frontend/`

**Performance Goals**: Sin degradación perceptible; sin fuentes ni recursos externos (Inter empaquetada localmente)

**Constraints**: Sin cambios en API/BD/reglas de negocio; textos en español; sin librerías de componentes; funcionar sin internet; tema oscuro predeterminado con acento verde lima; colores solo desde tokens CSS

**Scale/Scope**: 4 roles, 4 secciones de menú actuales (+3 reservadas de Sprint 2), ~11 pantallas, ~16 componentes reutilizables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Alcance y MVP | Cumple. Es un rediseño acotado; las secciones de Sprint 2 no se construyen. Falta (acción de documentación): registrar el sprint de interfaz en `docs/estado.md`. |
| II. Arquitectura separada | Cumple. Solo `frontend/`; la lógica de permisos sigue en el backend; no se crean carpetas alternativas. |
| III. Stack y dependencias | Cumple con justificación: 2 dependencias nuevas (`lucide-react`, `@fontsource/inter`) documentadas en research.md; sin librería de componentes. |
| IV. Base de datos | Cumple. Sin cambios. |
| V. Seguridad | Cumple. Ocultar opciones del menú no sustituye validación del backend; `RutaProtegida` se mantiene. |
| VI. Roles y permisos | Cumple. El menú refleja la tabla de roles sin ampliar permisos. |
| VII–VIII. Reglas de negocio / acceso | No aplica. |
| IX. API y errores | Cumple. Sin cambios; los errores se muestran en avisos sin detalles internos. |
| X. Pruebas | Cumple. Se actualizan las pruebas existentes y se agregan pruebas del menú por rol. |
| XI. UX/UI profesional | Es el objetivo: consistencia, confirmación de bajas, avisos de éxito/error, estados con color y texto. |

**Resultado del gate: APROBADO.** Sin violaciones; no se requiere Complexity Tracking.

**Re-evaluación tras el diseño (Phase 1): APROBADO.** El diseño no agrega capas ni dependencias adicionales.

## Project Structure

### Documentation (this feature)

```text
specs/002-interfaz-menu-lateral/
├── plan.md              # Este archivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── ui-contracts.md  # Phase 1: configuración del menú y contrato de componentes
└── tasks.md             # Phase 2 (/speckit-tasks, no lo crea este comando)
```

### Source Code (repository root)

```text
frontend/
├── package.json                       # + lucide-react, @fontsource/inter
├── src/
│   ├── App.jsx                        # rutas anidadas bajo Layout; rutas 403/404
│   ├── config/
│   │   └── menu.js                    # ÚNICA fuente de secciones del menú
│   ├── styles/
│   │   ├── tokens.css                 # variables :root (colores, tipografía, espacios, radios)
│   │   └── estilos.css                # estilos globales y de componentes, solo con tokens
│   ├── components/
│   │   ├── ui/                        # Layout, Sidebar, Topbar, PageHeader, Card, StatCard,
│   │   │                              # Button, Input, Select, FormField, Table, Badge, Toast,
│   │   │                              # ConfirmDialog, EmptyState, Spinner, Pagination
│   │   └── RutaProtegida.jsx          # se mantiene (Sin permiso usa la página 403)
│   └── pages/
│       ├── Login.jsx, Inicio.jsx, Usuarios.jsx, UsuarioForm.jsx,
│       ├── Clientes.jsx, ClienteForm.jsx, ClienteDetalle.jsx, MiPerfil.jsx   # rediseñadas
│       ├── NoEncontrado.jsx           # nueva
│       └── SinPermiso.jsx             # nueva
└── tests/                             # pruebas existentes actualizadas + menu.test.jsx, ui.test.jsx

backend/    # sin cambios
database/   # sin cambios
```

**Structure Decision**: Se mantiene la estructura web existente (`frontend/` + `backend/`). Los componentes visuales van en `frontend/src/components/ui/`; los componentes actuales `Layout`, `Mensaje`, `Confirmacion` y `Paginacion` se sustituyen por sus equivalentes en `ui/` y se retiran una vez migradas todas las pantallas (borrado de archivos: se consultará al equipo antes de eliminar, según CLAUDE.md).

## Complexity Tracking

Sin violaciones de la constitución que justificar.
