<!--

Plantilla de insumo para /speckit-specify.

NO lo pongas dentro de specs/ (esa carpeta la genera Spec Kit).

-->

# Insumo de especificación - Rediseño de interfaz: menú lateral y sistema visual

> **Referencias obligatorias para el agente:**
>
> * Contexto maestro: `docs/project-context.md`
> * Constitución: `.specify/memory/constitution.md` (Principio XI: UX/UI profesional y sencilla)
> * Sprint 1 ya implementado: `specs/001-base-usuarios-clientes/`
> * Este documento describe únicamente el rediseño visual y de navegación del frontend.

## 1. Contexto

El Sprint 1 dejó funcionando el inicio de sesión, la gestión de usuarios y roles y la gestión de clientes, pero la interfaz es una lista de enlaces sin estructura: todas las opciones aparecen amontonadas en la página de inicio y no hay un menú que permita moverse entre módulos.

Antes de construir los módulos del Sprint 2 (membresías, pagos, reconocimiento facial y control de acceso), se necesita una **estructura visual común** para que todas las pantallas actuales y futuras se vean ordenadas, consistentes y profesionales.

Este rediseño **no cambia la lógica de negocio, la API ni la base de datos**. Solo cambia el frontend (`frontend/`).

## 2. Objetivo

Dar al sistema GymAccess una interfaz moderna y ordenada, con un **menú lateral por rol**, un **encabezado** con el usuario en sesión y un **sistema de componentes visuales reutilizables**, aplicado a todas las pantallas existentes y listo para los módulos del Sprint 2.

## 3. Historias de usuario

### US-UI-01 — Menú lateral según el rol

Como usuario del sistema, quiero un menú lateral con las secciones que mi rol puede usar, para moverme entre módulos sin regresar al inicio.

### US-UI-02 — Encabezado con sesión

Como usuario, quiero ver en la parte superior el nombre de la sección, mi nombre, mi rol y un botón para cerrar sesión.

### US-UI-03 — Inicio con resumen

Como usuario, quiero que la pantalla de inicio me salude y muestre accesos rápidos a mis tareas más comunes en forma de tarjetas, en lugar de una lista de enlaces.

### US-UI-04 — Pantallas consistentes

Como usuario, quiero que todas las pantallas (listas, formularios, detalle) usen el mismo estilo de títulos, botones, tablas, formularios y mensajes, para que el sistema se sienta como una sola aplicación.

### US-UI-05 — Pantalla de inicio de sesión atractiva

Como usuario, quiero una pantalla de inicio de sesión clara y con la identidad de GymAccess.

### US-UI-06 — Uso en pantallas pequeñas

Como recepcionista, quiero poder usar el sistema en una laptop pequeña o tableta, con un menú que se pueda ocultar.

## 4. Estructura de navegación

### Diseño general

```text
┌──────────────┬──────────────────────────────────────────┐
│  GymAccess   │  Título de la sección      Nombre · Rol ⏻ │
│              ├──────────────────────────────────────────┤
│  ▸ Inicio    │                                          │
│  ▸ Clientes  │            Contenido de la página        │
│  ▸ Usuarios  │                                          │
│  ...         │                                          │
│              │                                          │
│  (sección    │                                          │
│   futuras)   │                                          │
└──────────────┴──────────────────────────────────────────┘
```

### Menú por rol (Sprint 1 + espacios reservados para Sprint 2)

| Sección | Administrador | Recepcionista | Entrenador | Cliente |
|---|---|---|---|---|
| Inicio | ✅ | ✅ | ✅ | ✅ |
| Clientes | ✅ | ✅ | ✅ (solo consulta) | — |
| Usuarios y roles | ✅ | — | — | — |
| Mi información | — | — | — | ✅ |
| Membresías *(Sprint 2)* | ✅ | ✅ | — | — |
| Pagos *(Sprint 2)* | ✅ | ✅ | — | — |
| Control de acceso *(Sprint 2)* | ✅ | ✅ | — | — |

Las secciones del Sprint 2 **no se muestran todavía**; el menú debe estar construido a partir de una configuración (lista de secciones con ícono, ruta y roles permitidos) para que agregarlas después sea solo añadir una entrada.

El menú se agrupa en bloques con encabezado pequeño, por ejemplo: **General** (Inicio), **Operación** (Clientes, Membresías, Pagos, Control de acceso), **Administración** (Usuarios y roles).

La opción activa del menú se resalta.

## 5. Sistema visual

### Dirección de diseño

* Estilo moderno de panel administrativo, limpio y con buen espacio en blanco.
* Tema **oscuro** como predeterminado (coherente con la versión actual), con buen contraste.
* Un color de acento que transmita energía (por ejemplo, verde lima o naranja) usado con moderación: botón principal, opción activa del menú y elementos destacados.
* Tipografía sans-serif legible (por ejemplo, Inter desde Google Fonts o la fuente del sistema).
* Bordes redondeados suaves, sombras ligeras y transiciones cortas.

### Tokens de diseño

Todos los colores, tamaños de letra, espacios y radios se definen **una sola vez** como variables CSS (`:root`) en un archivo de estilos global. Ninguna pantalla define colores sueltos.

Colores mínimos: fondo, superficie, superficie elevada, borde, texto, texto secundario, acento, éxito, advertencia, error e información.

### Componentes reutilizables

Crear en `frontend/src/components/ui/` (o equivalente) componentes reutilizables y usarlos en todas las pantallas:

* `Layout` (menú lateral + encabezado + contenido)
* `Sidebar` (menú por rol, colapsable en pantallas pequeñas)
* `Topbar` (título de la sección, usuario, rol y cerrar sesión)
* `PageHeader` (título, descripción corta y acciones de la página, por ejemplo "+ Registrar cliente")
* `Card` y `StatCard` (tarjetas y tarjetas de indicador)
* `Button` (variantes: principal, secundario, peligro, fantasma; estado de carga)
* `Input`, `Select`, `FormField` (etiqueta, campo, ayuda y error)
* `Table` (encabezado fijo, filas con hover, estado vacío)
* `Badge` (estados: activo, inactivo, y en Sprint 2: vigente, vencida, suspendida, cancelada, autorizado, rechazado)
* `Toast` o aviso de éxito/error
* `ConfirmDialog` (para bajas e inactivaciones)
* `EmptyState` y `Spinner`/estado de carga

### Íconos

Se permite agregar **una** librería ligera de íconos para React (por ejemplo `lucide-react`). Justificación: mejora la lectura del menú y de los botones sin cargar una librería completa de componentes. No se agregará ninguna librería de componentes (Material UI, Bootstrap, etc.).

## 6. Pantallas que se rediseñan

* Inicio de sesión
* Inicio (por rol), con tarjetas de acceso rápido
* Usuarios: lista y formulario
* Clientes: lista, registro, edición y detalle
* Mi información (cliente)
* Página "No encontrado" y página "Sin permiso"

## 7. Reglas

* El rediseño **no cambia** endpoints, validaciones del backend, reglas de negocio ni la base de datos.
* Ocultar una opción del menú **no** sustituye la validación de permisos del backend (Principio V); las rutas protegidas del frontend se mantienen.
* Toda acción muestra un mensaje de éxito o error (Principio XI).
* Las bajas e inactivaciones piden confirmación (Principio XI).
* Los estados se muestran con insignias de color **y** texto (no solo color).
* Textos de la interfaz en español.
* Las pruebas existentes del frontend se actualizan para la nueva estructura y deben seguir pasando.

## 8. Criterios de aceptación

* [ ] Todas las pantallas autenticadas se muestran dentro del mismo `Layout` con menú lateral y encabezado.
* [ ] El menú muestra únicamente las secciones permitidas para el rol del usuario.
* [ ] La sección activa se resalta en el menú.
* [ ] El menú se puede ocultar y mostrar en pantallas menores a 1024 px.
* [ ] La pantalla de inicio muestra un saludo y tarjetas de acceso rápido según el rol.
* [ ] Las listas de usuarios y clientes usan el componente `Table`, con estado vacío y paginación visibles.
* [ ] Los formularios usan `FormField`, muestran errores por campo y un estado de carga al guardar.
* [ ] Los estados se muestran con `Badge`.
* [ ] Existen páginas para "No encontrado" y "Sin permiso".
* [ ] Colores, espacios y tipografía provienen de variables CSS globales.
* [ ] Agregar una sección nueva al menú solo requiere añadir una entrada a la configuración del menú.
* [ ] Las pruebas del frontend y del backend siguen pasando.

## 9. Fuera de alcance

* Cambios en la API, base de datos o reglas de negocio.
* Módulos del Sprint 2 (solo se deja el menú preparado).
* Tema claro/oscuro intercambiable (opcional para el futuro).
* Gráficas del dashboard (Sprint 3).
* Librerías de componentes completas.

## 10. Decisiones pendientes para `/speckit-clarify`

* Color de acento definitivo.
* Fuente: Inter (Google Fonts) o fuente del sistema.
* Nombre y logotipo de texto que aparecerá en el menú.
