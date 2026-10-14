# Contratos de interfaz (frontend)

No hay endpoints nuevos ni cambios en la API REST existente. Los contratos de este cambio son la configuración del menú y la interfaz (props) de los componentes reutilizables.

## 1. Configuración del menú

```js
// frontend/src/config/menu.js
export const BLOQUES = [
  { id: 'general', etiqueta: 'General' },
  { id: 'operacion', etiqueta: 'Operación' },
  { id: 'administracion', etiqueta: 'Administración' },
];

export const SECCIONES = [
  { id, etiqueta, ruta, icono, bloque, roles },
];

// Devuelve las secciones visibles para un rol, agrupadas por bloque (omite bloques vacíos).
export function menuParaRol(rol) { /* -> [{ bloque, secciones: [...] }] */ }
```

**Garantías**: `menuParaRol` es la única función que decide qué ve cada rol; `Sidebar` la usa (el inicio ya no repite el menú). Para agregar una sección basta con una entrada nueva en `SECCIONES`.

## 2. Componentes (`frontend/src/components/ui/`)

| Componente | Props principales | Comportamiento clave |
|---|---|---|
| `Layout` | `children` / `Outlet` | Sidebar + Topbar + contenido; controla `menuAbierto` |
| `Sidebar` | `grupos` (resultado de `menuParaRol`), `abierto`, `onCerrar` | `nav` con `aria-label`; opción activa con `aria-current="page"`; logotipo “GymAccess” con ícono; panel superpuesto < 1024 px |
| `Topbar` | `titulo`, `usuario`, `onMenu`, `onCerrarSesion` | Título de sección, nombre · rol, botón cerrar sesión, botón de menú < 1024 px |
| `PageHeader` | `titulo`, `descripcion?`, `acciones?` | Encabezado de página con acciones (p. ej. “+ Registrar cliente”) |
| `Card`, `StatCard` | `titulo?`, `children` / `etiqueta`, `valor`, `icono?` | Contenedores; `Card` también admite `to` (tarjeta enlazable), aunque el inicio ya no la usa |
| `Button` | `variante`: `principal`\|`secundario`\|`peligro`\|`fantasma`; `cargando?`; `icono?` | Con `cargando` queda deshabilitado y muestra `Spinner` |
| `FormField` | `etiqueta`, `ayuda?`, `error?`, `id`, `children` | Asocia etiqueta, ayuda y error al campo (`aria-describedby`, `aria-invalid`) |
| `Input`, `Select` | props nativas | Estilo uniforme con tokens |
| `Table` | `columnas`, `filas`, `vacio?` | Encabezado fijo, hover de fila, `EmptyState` cuando no hay filas |
| `Pagination` | `pagina`, `totalPaginas`, `onCambiar` | Reemplaza a `Paginacion` |
| `Badge` | `variante`, `children` (texto obligatorio) | Color + texto |
| `Toast` / `useToast()` | `mostrar({ tipo: 'exito'\|'error', texto })` | `role="status"` / `role="alert"`; se oculta solo |
| `ConfirmDialog` | `abierto`, `titulo`, `texto`, `textoConfirmar`, `onConfirmar`, `onCancelar` | Reemplaza a `Confirmacion`; Escape cancela |
| `EmptyState` | `titulo`, `texto?`, `accion?` | Estado vacío |
| `Spinner` | `etiqueta?` | Indicador de carga accesible |

## 3. Rutas

| Ruta | Acceso | Pantalla |
|---|---|---|
| `/login` | pública | Inicio de sesión |
| `/` | cualquier rol con sesión | Inicio |
| `/clientes`, `/clientes/:id` | admin, recepcionista, entrenador | Lista y detalle |
| `/clientes/nuevo`, `/clientes/:id/editar` | admin, recepcionista | Formulario |
| `/usuarios`, `/usuarios/nuevo`, `/usuarios/:id/editar` | admin | Usuarios |
| `/mi-perfil` | cliente | Mi información |
| `/sin-permiso` y rol no permitido | con sesión | Sin permiso |
| cualquier otra | con sesión → No encontrado; sin sesión → `/login` | |

Las rutas y los permisos por rol son los mismos que en Sprint 1; ocultar una opción no sustituye la validación del backend.
