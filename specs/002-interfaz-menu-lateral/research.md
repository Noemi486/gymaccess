# Research: Rediseño de interfaz

Todas las decisiones técnicas del plan. No quedan `NEEDS CLARIFICATION`.

## R1. Librería de íconos

- **Decision**: Agregar `lucide-react` como única dependencia nueva.
- **Rationale**: Íconos SVG individuales importables por nombre (el empaquetado solo incluye los usados), licencia permisiva, funciona sin internet, API de componentes React simple. Mejora la lectura del menú y los botones (spec, Assumptions; Principio III exige justificar).
- **Alternatives considered**: SVG a mano en el repositorio (sin dependencia, pero más trabajo y menos consistencia para ~15 íconos y los de Sprint 2); `react-icons` (empaqueta muchas familias, más pesada); Font Icons desde CDN (requiere internet, contradice la decisión de fuente del sistema).
- **Pendiente de implementación**: fijar la versión estable vigente con `npm view lucide-react version` al instalar.

## R2. Tokens de diseño y tema

- **Decision**: Un archivo `styles/tokens.css` con todas las variables en `:root`: fondo, superficie, superficie elevada, borde, texto, texto secundario, acento (verde lima), éxito, advertencia, error, información, escala tipográfica, espacios, radios, sombras y duraciones de transición. Tema **oscuro fijo** como predeterminado.
- **Rationale**: FR-015/FR-016. La hoja actual alterna claro/oscuro con `prefers-color-scheme`; el spec pide oscuro por defecto y deja fuera el tema intercambiable, así que se elimina esa media query. Los tokens quedan listos para un tema claro futuro.
- **Alternatives considered**: Mantener `prefers-color-scheme` (rompe "oscuro predeterminado" en equipos con tema claro); CSS-in-JS o Tailwind (dependencia nueva sin justificación).
- **Contraste**: el texto sobre el acento verde lima usa un color oscuro (no blanco) para cumplir contraste mínimo AA (≥ 4.5:1); se verifica en `quickstart.md`.

## R3. Tipografía

- **Decision**: Inter incluida localmente con la dependencia `@fontsource/inter` (aprobada por el equipo el 2026-10-13), importando solo los pesos latinos 400, 500, 600 y 700. Pila: `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` (la fuente del sistema queda como respaldo).
- **Justificación de la dependencia (Principio III)**: la fuente se empaqueta con la aplicación, así que se ve igual en todos los equipos y funciona sin internet (no hay llamadas a Google Fonts). Solo aporta archivos de fuente; no agrega código que se ejecute. Se limita a los pesos usados para no inflar la carga.
- **Rationale**: dirección de diseño del equipo (Inter) combinada con la clarificación original de no depender de descargas externas.
- **Alternatives considered**: Google Fonts por CDN (requiere internet, rechazada); solo fuente del sistema (apariencia distinta según el equipo); Inter si está instalada (no garantiza el mismo aspecto).

## R4. Estructura de layout y rutas

- **Decision**: Usar el patrón de rutas anidadas de react-router: una ruta padre con `Layout` (que renderiza `<Outlet />`) que exige sesión, y rutas hijas con `RutaProtegida` por rol. Dos rutas especiales: `/sin-permiso` y `*` (No encontrado) dentro del Layout si hay sesión; sin sesión, `*` lleva a `/login`.
- **Rationale**: Hoy cada ruta envuelve su propia pantalla en `Privada`, repitiendo el Layout; el padre único garantiza FR-001 y evita desmontar el menú al navegar. `RutaProtegida` con rol no permitido redirige/renderiza la página "Sin permiso" en lugar del mensaje en línea.
- **Alternatives considered**: Mantener `Privada` por ruta (funciona, pero el menú se remonta y pierde estado colapsado en cada navegación).

## R5. Configuración del menú

- **Decision**: `src/config/menu.js` exporta una lista de secciones `{ id, etiqueta, ruta, icono, bloque, roles }` y la lista de bloques con su orden. `Sidebar` y las tarjetas de acceso rápido de `Inicio` filtran esta misma lista por rol. Detalle en [contracts/ui-contracts.md](contracts/ui-contracts.md).
- **Rationale**: FR-004, SC-004: agregar una sección de Sprint 2 es añadir una entrada. Una sola fuente evita que menú e inicio se desincronicen.
- **Alternatives considered**: Definir el menú dentro de `Sidebar` (menos extensible). Las tarjetas de acceso rápido del inicio se descartaron por repetir el menú (cambio 2026-10-13).

## R6. Menú colapsable en pantallas pequeñas

- **Decision**: Punto de corte en 1024 px mediante CSS (media query) y un estado `menuAbierto` en `Layout`. Por debajo de 1024 px el menú es un panel superpuesto con botón de hamburguesa en el `Topbar`; se cierra al elegir una sección, al pulsar fuera o con Escape. Por encima, queda fijo. El estado no se persiste.
- **Rationale**: FR-005, US-6. No requiere librerías ni `localStorage` (el spec no pide recordar el estado).
- **Alternatives considered**: Menú siempre visible con scroll horizontal (rompe SC-006); persistir el estado (no solicitado).

## R7. Componentes y accesibilidad

- **Decision**: Componentes propios en `components/ui/` con HTML semántico: `nav` con `aria-label` y `aria-current="page"` en la opción activa, `table` con `th scope`, campos con `label`/`aria-describedby`/`aria-invalid`, avisos con `role="status"`/`role="alert"`, diálogo con `role="dialog"` y foco inicial en el botón seguro. `Toast` se gestiona con un pequeño contexto (`ToastProvider`/`useToast`).
- **Rationale**: Los componentes actuales (`Mensaje`, `Confirmacion`) ya usan roles ARIA; se conserva y se amplía. FR-010, FR-011, FR-012, FR-013. Las pruebas existentes se apoyan en roles y textos, lo que reduce el riesgo al migrar.
- **Alternatives considered**: Librería de componentes (descartada por el spec y la constitución).

## R8. Migración y pruebas

- **Decision**: Migrar pantalla por pantalla en este orden: tokens + componentes base → Layout/Sidebar/Topbar y rutas → Inicio → Login → Usuarios → Clientes → Mi información → 403/404 → retiro de componentes y CSS antiguos. Después de cada pantalla se ejecuta `npm test` en `frontend/`. Las pruebas existentes se ajustan solo en lo que cambie de estructura (textos/roles), nunca para debilitar sus verificaciones. Se agregan pruebas de menú por rol, ruta activa, colapso del menú, y de los componentes `Badge`, `FormField`, `Table`, `ConfirmDialog`.
- **Rationale**: Principio X y FR-020; la regla del proyecto de detenerse por fases para que el equipo pruebe.
- **Alternatives considered**: Reescritura total en un paso (más riesgo de romper pruebas y revisión).

## R9. Alcance negativo verificado

- No se modifican `backend/`, `database/` ni `src/api/cliente.js` (salvo que una pantalla requiera ajustar cómo muestra un error; sin cambiar endpoints).
