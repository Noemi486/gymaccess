# Data Model: Rediseño de interfaz

Este cambio **no toca la base de datos ni la API**. Solo define estructuras de configuración del frontend.

## SeccionMenu (configuración en `frontend/src/config/menu.js`)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | texto único | Identificador estable (`inicio`, `clientes`, `usuarios`, `mi-informacion`) |
| `etiqueta` | texto | Nombre visible en español |
| `ruta` | texto | Ruta de la aplicación; para resaltar la opción activa se compara por prefijo |
| `icono` | componente de ícono | Ícono de la librería elegida |
| `bloque` | `general` \| `operacion` \| `administracion` | Grupo del menú |
| `roles` | lista de roles | Roles que la ven: `administrador`, `recepcionista`, `entrenador`, `cliente` |

**Reglas**
- Una sección se muestra solo si el rol del usuario está en `roles`.
- Un bloque sin secciones visibles para el rol no se muestra.
- El orden de los bloques es `general`, `operacion`, `administracion`; dentro de cada bloque, el orden de la lista.
- Las secciones de Sprint 2 no se incluyen todavía; añadirlas es agregar entradas (SC-004).

**Contenido inicial**

| id | etiqueta | ruta | bloque | roles |
|---|---|---|---|---|
| inicio | Inicio | `/` | general | todos |
| clientes | Clientes | `/clientes` | operacion | administrador, recepcionista, entrenador |
| usuarios | Usuarios y roles | `/usuarios` | administracion | administrador |
| mi-informacion | Mi información | `/mi-perfil` | general | cliente |

## Tokens de diseño (`frontend/src/styles/tokens.css`)

Grupos de variables CSS (nombres definitivos en implementación):

- Colores: fondo, superficie, superficie elevada, borde, texto, texto secundario, acento (+ texto sobre acento), éxito, advertencia, error, información (cada estado con su fondo suave).
- Tipografía: familia, tamaños (xs–2xl), pesos, altura de línea.
- Espacios: escala de 4 px.
- Radios, sombras y duración de transición.

## Variantes de Badge

| Variante | Estados | Texto visible |
|---|---|---|
| éxito | activo, vigente, autorizado | el estado en español |
| neutral | inactivo | “Inactivo” |
| advertencia | suspendida | “Suspendida” |
| error | vencida, cancelada, rechazado | el estado en español |

El texto siempre acompaña al color (FR-011). Las variantes de Sprint 2 se definen ahora pero no se usan aún.

## Sesión (existente, sin cambios)

`AuthContext` expone `usuario { nombre, rol }` y `cerrarSesion`; el menú, el encabezado y el inicio los leen. No se agregan campos.
