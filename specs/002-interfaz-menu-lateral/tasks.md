# Tasks: Rediseño de interfaz: menú lateral y sistema visual

**Input**: Documentos de diseño en `/specs/002-interfaz-menu-lateral/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: Se incluyen tareas de prueba porque el spec lo exige (FR-020, SC-010) y la constitución (Principio X). Se usan Vitest + Testing Library en `frontend/tests/`.

**Organization**: Tareas agrupadas por historia de usuario. Solo se toca `frontend/` (más `docs/estado.md`); `backend/` y `database/` NO se modifican.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario (US1–US7) del spec

## Reglas transversales (aplican a todas las tareas)

- Textos de la interfaz en español; comentarios de código en español.
- Colores, tamaños, espacios y radios SOLO desde `frontend/src/styles/tokens.css` (sin colores literales en otros archivos).
- No cambiar endpoints, `src/api/cliente.js` ni validaciones; conservar textos que las pruebas existentes verifican (p. ej. "Nuevo cliente", "Página N de M", "Activo"/"Inactivo", "Guardar", "Siguiente").
- No borrar archivos sin preguntar (CLAUDE.md); las tareas de retiro piden confirmación.
- Detenerse al terminar cada fase para que el equipo pruebe.

---

## Phase 1: Setup

- [X] T001 Justificar e instalar la dependencia nueva (más `@fontsource/inter`, aprobada el 2026-10-13): ejecutar `npm view lucide-react version` y `npm install lucide-react` en `frontend/`, actualizando `frontend/package.json` y `frontend/package-lock.json`
- [X] T002 Confirmar la línea base: ejecutar `npm test` en `frontend/` y `backend/` y anotar que todo pasa antes de cambiar nada

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: tokens de diseño y componentes base reutilizables.

- [X] T003 Crear `frontend/src/styles/tokens.css` con variables `:root` del tema oscuro: fondo, superficie, superficie elevada, borde, texto, texto secundario, acento verde lima y su texto oscuro (contraste ≥ 4.5:1), éxito, advertencia, error, información (cada uno con fondo suave), pila tipográfica `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`, escala de tamaños, espacios de 4 px, radios, sombras y duración de transición; sin `prefers-color-scheme`
- [X] T004 Reescribir `frontend/src/styles/estilos.css` para que importe `tokens.css` y use únicamente variables (reset, tipografía, enlaces, foco visible, utilidades de layout); eliminar los colores literales y la media query de tema claro; actualizar la importación en `frontend/src/main.jsx` si hace falta
- [X] T005 [P] Crear `frontend/src/components/ui/Button.jsx` con variantes `principal`, `secundario`, `peligro`, `fantasma`, prop `cargando` (deshabilita y muestra Spinner) e `icono` opcional; permitir renderizar como `Link` (prop `to`)
- [X] T006 [P] Crear `frontend/src/components/ui/Spinner.jsx` y `frontend/src/components/ui/EmptyState.jsx` (`titulo`, `texto?`, `accion?`; spinner con `role="status"` y etiqueta accesible)
- [X] T007 [P] Crear `frontend/src/components/ui/Card.jsx` y `frontend/src/components/ui/StatCard.jsx` (`Card` admite `to` para tarjeta de acceso rápido; `StatCard` con `etiqueta`, `valor`, `icono?`)
- [X] T008 [P] Crear `frontend/src/components/ui/Badge.jsx` con variantes éxito, neutral, advertencia, error, información; el texto es obligatorio (nunca solo color); exportar un mapa de estado→variante que cubra activo, inactivo, vigente, vencida, suspendida, cancelada, autorizado, rechazado (según data-model.md)
- [X] T009 [P] Crear `frontend/src/components/ui/FormField.jsx`, `Input.jsx` y `Select.jsx` (etiqueta asociada, ayuda y error con `aria-describedby`, `aria-invalid`; conservar que la etiqueta pueda incluir "(opcional)" y `required` nativo, como verifican las pruebas existentes)
- [X] T010 [P] Crear `frontend/src/components/ui/Table.jsx` (`columnas`, `filas`, `vacio`; `th scope="col"`, encabezado fijo, hover de fila, `EmptyState` cuando no hay filas) y `frontend/src/components/ui/Pagination.jsx` (mismo texto "Página N de M" y botones "Anterior"/"Siguiente" que el actual `Paginacion.jsx`)
- [X] T011 [P] Crear `frontend/src/components/ui/ConfirmDialog.jsx` (mismas props que `Confirmacion.jsx`, `role="dialog"`, foco inicial en el botón seguro, Escape cancela)
- [X] T012 Crear `frontend/src/components/ui/Toast.jsx` con `ToastProvider` y `useToast()` (`mostrar({ tipo: 'exito'|'error', texto })`, `role="status"`/`role="alert"`, se oculta solo); montar el proveedor en `frontend/src/main.jsx` o `frontend/src/App.jsx`
- [X] T013 [P] Crear `frontend/tests/ui.test.jsx` con pruebas de `Badge` (siempre muestra texto), `FormField` (error y ayuda asociados al campo), `Table` (estado vacío), `Button` (con `cargando` queda deshabilitado) y `ConfirmDialog` (confirmar/cancelar/Escape)

**Checkpoint**: `npm test` y `npm run build` en `frontend/` pasan; los componentes existen pero aún no se usan en las pantallas.

---

## Phase 3: User Story 1 - Menú lateral según el rol (Priority: P1) 🎯 MVP

**Goal**: todas las pantallas autenticadas dentro de un Layout con menú lateral que muestra solo las secciones del rol, agrupadas, con la activa resaltada.

**Independent Test**: iniciar sesión con los 4 roles y comparar el menú con el Anexo del spec; navegar entre secciones sin pasar por el inicio; abrir una ruta no permitida muestra "Sin permiso".

### Tests for User Story 1

- [X] T014 [P] [US1] Crear `frontend/tests/menu.test.jsx`: `menuParaRol` devuelve exactamente las secciones del Anexo para cada uno de los 4 roles (sin bloques vacíos); `Sidebar` marca con `aria-current="page"` solo la sección activa; agregar una entrada de prueba a la lista hace que aparezca solo para sus roles

### Implementation for User Story 1

- [X] T015 [US1] Crear `frontend/src/config/menu.js` con `BLOQUES` (General, Operación, Administración), `SECCIONES` (inicio, clientes, usuarios, mi-información según data-model.md, con íconos de lucide-react y `acceso` para las tarjetas del inicio) y `menuParaRol(rol)` según contracts/ui-contracts.md
- [X] T016 [US1] Crear `frontend/src/components/ui/Sidebar.jsx`: `nav` con `aria-label`, logotipo "GymAccess" con ícono de pesa o rayo, bloques con encabezado pequeño, opción activa por prefijo de ruta (`NavLink`) con `aria-current="page"`
- [X] T017 [US1] Crear `frontend/src/components/ui/Layout.jsx`: Sidebar + área de contenido con `<Outlet />`, estado `menuAbierto`; por ahora con una barra superior mínima provisional que se sustituye en US2
- [X] T018 [US1] Reestructurar `frontend/src/App.jsx` con rutas anidadas: una ruta padre autenticada con `Layout` y rutas hijas con `RutaProtegida` por rol (mismos roles y rutas que hoy, según contracts/ui-contracts.md); eliminar el helper `Privada`
- [X] T019 [US1] Ajustar `frontend/src/components/RutaProtegida.jsx` para que, con rol no permitido, navegue/renderice la ruta de "Sin permiso" (la página se crea en US7; mientras tanto mantiene el mensaje actual) sin quitar la validación por rol
- [X] T020 [US1] Dar estilos de Layout y Sidebar en `frontend/src/styles/estilos.css` usando solo tokens (menú fijo ≥ 1024 px, opción activa con acento)
- [X] T021 [US1] Ejecutar `npm test` en `frontend/` y ajustar las pruebas existentes que dependan del antiguo `Layout`/encabezado (`frontend/tests/*.test.jsx`) sin debilitar sus verificaciones

**Checkpoint**: el menú por rol funciona y es probable de forma independiente. Detenerse para que el equipo pruebe.

---

## Phase 4: User Story 2 - Encabezado con la sesión (Priority: P1)

**Goal**: encabezado con título de la sección, nombre · rol y botón de cerrar sesión.

**Independent Test**: navegar por varias secciones; el título cambia, nombre y rol permanecen, cerrar sesión lleva a `/login`.

- [X] T022 [P] [US2] Añadir a `frontend/tests/menu.test.jsx` (o crear `frontend/tests/topbar.test.jsx`) pruebas: el `Topbar` muestra título, nombre y rol con etiqueta en español; un nombre largo no rompe el diseño (clase de recorte); "Cerrar sesión" llama a `cerrarSesion` y redirige a `/login`
- [X] T023 [US2] Crear `frontend/src/components/ui/Topbar.jsx` (`titulo`, `usuario`, `onCerrarSesion`; `onMenu` se añade en la Fase 8): título y menú de usuario con avatar de iniciales, nombre y rol, con opción "Cerrar sesión" (cierra con Escape y al pulsar fuera); el título se obtiene de la sección del menú que coincide por prefijo con la ruta (también para `/clientes/:id`, `/clientes/nuevo`, etc.) con valor por defecto "GymAccess"
- [X] T024 [US2] Integrar `Topbar` en `frontend/src/components/ui/Layout.jsx` (sustituir la barra provisional) y sus estilos en `frontend/src/styles/estilos.css`; recorte con puntos suspensivos para nombres largos

**Checkpoint**: US1 y US2 completas = estructura de navegación terminada.

---

## Phase 5: User Story 3 - Inicio como panel de resumen por rol (Priority: P2)

**Goal**: inicio con saludo y fecha, botón "+ Registrar cliente" (administrador y recepcionista) y resumen por rol: indicadores, últimos 5 clientes, buscador de clientes y tarjeta propia del cliente. Sin tarjetas de acceso rápido (repiten el menú).

**Independent Test**: abrir el inicio con cada rol; solo aparece el contenido de su rol, las cifras coinciden con las listas de clientes y usuarios, el buscador lleva a `/clientes` con el texto escrito y el botón "+ Registrar cliente" lleva al formulario.

**Endpoint aprobado por el equipo (2026-10-13)**: las tareas T025 y T026 crean UN endpoint nuevo de solo lectura (`GET /api/resumen`) porque los endpoints actuales no entregan "últimos 5 registrados" ni "registrados hoy / este mes" (la lista de clientes se ordena por apellido y no filtra por fecha). Debe quedar preparado para que en Sprint 2 se le agreguen los indicadores `accesos_hoy` y `membresias_por_vencer` sin cambiar lo existente (la respuesta es un objeto con claves por indicador, y el servicio arma las claves según el rol).

- [X] T025 [P] [US3] **(aprobado)** Crear `backend/tests/integration/resumen.test.js` contra la base `gymaccess_test` (nunca `gymaccess`): 401 sin sesión; 403 para el rol cliente; el administrador recibe clientes activos/inactivos, registrados este mes, usuarios del sistema, usuarios por rol y últimos 5 registrados; la recepcionista recibe activos, registrados hoy y últimos 5; el entrenador recibe solo clientes activos (sin datos de contacto ni cifras de usuarios); las cifras coinciden con las listas existentes; los últimos 5 vienen del más reciente al más antiguo
- [X] T026 [US3] **(aprobado)** Implementar `GET /api/resumen` solo lectura en `backend/src/models/resumen.model.js` (consultas SELECT parametrizadas), `backend/src/services/resumen.service.js` (arma la respuesta según el rol y omite lo que el rol no puede ver), `backend/src/controllers/resumen.controller.js` y `backend/src/routes/resumen.routes.js`; montarlo en `backend/src/routes/index.js` con `autenticar` y `autorizar('administrador', 'recepcionista', 'entrenador')`; ES Modules, sin DELETE ni escrituras, errores por el manejador central
- [X] T027 [P] [US3] Crear `frontend/tests/inicio.test.jsx` con la API simulada: saludo con la fecha; botón "+ Registrar cliente" solo para administrador y recepcionista (enlaza a `/clientes/nuevo`); contenido por rol (administrador: 4 indicadores, tabla de últimos 5 y usuarios por rol; recepcionista: buscador, activos, registrados hoy y últimos 5; entrenador: buscador y activos, sin contacto; cliente: tarjeta con sus datos y sin indicadores); enviar el buscador navega a `/clientes?q=texto`; estado vacío sin clientes; aviso de error si falla la carga y el saludo sigue visible; no hay tarjetas de acceso rápido
- [X] T028 [P] [US3] Crear `frontend/src/components/ui/PageHeader.jsx` (`titulo`, `descripcion?`, `acciones?`) y sus estilos en `frontend/src/styles/estilos.css`
- [X] T029 [US3] Crear `frontend/src/config/indicadores.js` con los indicadores del inicio por rol (`id`, `etiqueta`, `icono`, `roles`, `clave` del dato, `disponible`), incluyendo las entradas reservadas de Sprint 2 "Accesos de hoy" y "Membresías por vencer" con `disponible: false` (no se muestran); retirar el campo `acceso` de `frontend/src/config/menu.js` (y de `specs/.../data-model.md`) porque ya no hay tarjetas de acceso rápido
- [X] T030 [US3] Crear `frontend/src/components/BuscadorClientes.jsx` (campo grande con botón "Buscar" que navega a `/clientes?q=<texto>`) y hacer que `frontend/src/pages/Clientes.jsx` aplique el parámetro `q` de la URL como búsqueda inicial (sin cambiar los endpoints); añadir su prueba en `frontend/tests/clientes-lista.test.jsx`
- [X] T031 [US3] Reescribir `frontend/src/pages/Inicio.jsx`: `PageHeader` con "Hola, {nombre}", fecha larga en español y el botón principal "+ Registrar cliente" (administrador y recepcionista); paneles por rol con `StatCard`, `Table` (últimos 5 clientes), usuarios por rol y buscador; cliente con una `Card` compacta (nombre completo, estado y correo, y botón "Ver mi información"; datos de `GET /clientes/me`) y, debajo, el espacio reservado para las tarjetas de Sprint 2 declaradas en `frontend/src/config/tarjetasCliente.js` (Mi membresía, Acceso facial, Mis últimas visitas y Mis pagos; con `disponible: false`, no se muestran; diseño en el Anexo del spec); `EmptyState`/`Spinner`/`useToast` para vacío, carga y error; datos desde `GET /api/resumen` (o, sin ese endpoint, desde los conteos de las listas existentes); retirar `ACCESOS_POR_ROL` y las tarjetas de acceso rápido
- [X] T032 [US3] Estilos del inicio en `frontend/src/styles/estilos.css` (cuadrícula de `StatCard`, buscador grande, espacio reservado para indicadores de Sprint 2 sin mostrar contenido) usando solo tokens

---

## Phase 6: User Story 4 - Pantallas consistentes (Priority: P2)

**Goal**: Usuarios, Clientes y Mi información con los mismos componentes, avisos, confirmaciones e insignias.

**Independent Test**: recorrer las pantallas verificando tabla con estado vacío y paginación, errores por campo, botón en carga, avisos de éxito/error, confirmación de bajas e insignias con texto.

- [ ] T033 [US4] Migrar `frontend/src/pages/Usuarios.jsx` a `PageHeader`, `Table`, `Pagination`, `Badge`, `Button`, `Select`/`Input`, `EmptyState`, `Spinner` y `ConfirmDialog`/`useToast` (inactivar/activar pide confirmación y muestra aviso); conservar textos y roles que verifica `frontend/tests/usuarios.test.jsx`
- [ ] T034 [US4] Migrar `frontend/src/pages/UsuarioForm.jsx` a `FormField`, `Input`, `Select`, `Button` con `cargando` y `useToast` (errores por campo en español, estado de carga al guardar, aviso de éxito/error)
- [ ] T035 [US4] Migrar `frontend/src/pages/Clientes.jsx` a los mismos componentes; sustituir `InsigniaEstado` por `Badge` (mantener el texto "Activo"/"Inactivo"), conservar el enlace "Nuevo cliente" a `/clientes/nuevo`, las columnas por rol (el entrenador no ve contacto), "Página N de M" y la búsqueda; ajustar `frontend/tests/clientes-lista.test.jsx` solo en lo estructural
- [ ] T036 [US4] Migrar `frontend/src/pages/ClienteForm.jsx` a `FormField`/`Input`/`Button` con `cargando` y `useToast`; conservar etiquetas ("Nombre", "Teléfono", "Correo (opcional)"…), `required`, mensajes "Cliente registrado"/"Cliente actualizado" y "Este campo es obligatorio."; ajustar `frontend/tests/cliente-form.test.jsx` solo en lo estructural
- [X] T037 [US4] Rediseñar `frontend/src/pages/ClienteDetalle.jsx` con el perfil compartido `frontend/src/components/PerfilCliente.jsx` (avatar grande de iniciales, nombre completo, `Badge` de estado, "Cliente desde <fecha>" y datos en cuadrícula de 2 columnas, 1 en pantallas pequeñas, cada uno con ícono, etiqueta gris pequeña y valor); acciones "Volver a la lista" y "Editar" (según el rol) con `Button`; pruebas en `frontend/tests/perfil.test.jsx`
- [X] T038 [US4] Rediseñar `frontend/src/pages/MiPerfil.jsx` con `PerfilCliente` y el aviso "Si algún dato es incorrecto, pide a recepción que lo actualice." dentro de una caja informativa con ícono (`frontend/src/components/ui/InfoBox.jsx`); `Avatar` compartido en `frontend/src/components/ui/Avatar.jsx`; pruebas en `frontend/tests/perfil.test.jsx` y `frontend/tests/mi-perfil.test.jsx`
- [ ] T039 [US4] Verificar que todo aviso de éxito/error de las pantallas usa `useToast` o un aviso en línea equivalente y que toda baja/inactivación pasa por `ConfirmDialog`; ejecutar `npm test` en `frontend/`

---

## Phase 7: User Story 5 - Pantalla de inicio de sesión (Priority: P3)

**Goal**: login con la identidad de GymAccess y el mismo estilo del sistema.

**Independent Test**: abrir sin sesión; se ve el logotipo, el formulario estilizado y el error claro con credenciales incorrectas.

- [ ] T040 [US5] Rediseñar `frontend/src/pages/Login.jsx` con tarjeta centrada, logotipo "GymAccess" con ícono, `FormField`/`Input`/`Button` con `cargando` y error accesible en español sin detalles técnicos; conservar etiquetas y textos que verifica `frontend/tests/login.test.jsx`
- [ ] T041 [US5] Ajustar `frontend/tests/login.test.jsx` solo en lo estructural y comprobar que el mensaje de credenciales incorrectas sigue visible

---

## Phase 8: User Story 6 - Pantallas pequeñas (Priority: P3)

**Goal**: menú ocultable por debajo de 1024 px sin desplazamiento horizontal de la página.

**Independent Test**: reducir la ventana a < 1024 px y 360 px; el menú se oculta, se abre con el botón y se cierra al elegir sección, al pulsar fuera o con Escape.

- [ ] T042 [P] [US6] Añadir a `frontend/tests/menu.test.jsx` pruebas del estado del menú: el botón de menú abre el panel, elegir una sección lo cierra, Escape lo cierra, el botón tiene `aria-expanded`/`aria-controls`
- [ ] T043 [US6] Implementar en `frontend/src/components/ui/Layout.jsx`, `Sidebar.jsx` y `Topbar.jsx` el panel superpuesto con fondo de cierre, botón de menú (ícono) visible solo < 1024 px, cierre al navegar, al pulsar fuera y con Escape, y foco devuelto al botón
- [ ] T044 [US6] Añadir en `frontend/src/styles/estilos.css` las reglas `@media (max-width: 1023px)` (menú superpuesto, tablas con desplazamiento contenido dentro de su contenedor, formularios en una columna) para que no haya desplazamiento horizontal de la página entre 360 px y 1920 px

---

## Phase 9: User Story 7 - Páginas "No encontrado" y "Sin permiso" (Priority: P3)

**Goal**: páginas claras dentro del Layout con opción de volver al inicio.

**Independent Test**: abrir una dirección inexistente y una de otro rol; se muestran las páginas correspondientes con botón "Volver al inicio".

- [ ] T045 [P] [US7] Crear `frontend/tests/paginas-error.test.jsx`: ruta inexistente con sesión muestra "No encontrado"; rol no permitido muestra "Sin permiso"; ambas con enlace "Volver al inicio"; ruta inexistente sin sesión lleva a `/login`
- [ ] T046 [P] [US7] Crear `frontend/src/pages/NoEncontrado.jsx` y `frontend/src/pages/SinPermiso.jsx` con `EmptyState`/ícono, texto en español y `Button` "Volver al inicio"
- [ ] T047 [US7] Conectar en `frontend/src/App.jsx` y `frontend/src/components/RutaProtegida.jsx`: ruta `*` con sesión → `NoEncontrado`, sin sesión → `/login`; rol no permitido → `SinPermiso` dentro del Layout (la validación real sigue en el backend)

---

## Phase 10: Polish & Cross-Cutting

- [ ] T048 Preguntar al equipo y, con su confirmación, retirar los componentes sustituidos `frontend/src/components/Layout.jsx`, `Mensaje.jsx`, `Confirmacion.jsx` y `Paginacion.jsx` (tras comprobar con búsqueda que ninguna pantalla los importa); si no se confirma, dejarlos sin uso y anotarlo en `docs/estado.md`
- [ ] T049 Comprobar FR-015/SC-005: buscar en `frontend/src` colores literales (`#`, `rgb(`, `hsl(`) fuera de `frontend/src/styles/tokens.css` y corregirlos
- [ ] T050 Revisar contraste (≥ 4.5:1) del texto sobre el acento, textos secundarios e insignias, y que el foco de teclado sea visible
- [ ] T051 Ejecutar `npm test` y `npm run build` en `frontend/` y `npm test` en `backend/`; todo debe pasar (SC-010)
- [ ] T052 Recorrer `specs/002-interfaz-menu-lateral/quickstart.md` con los 4 roles y marcar los resultados
- [ ] T053 Actualizar `docs/estado.md` con el avance del sprint de interfaz (fase terminada, pruebas, decisiones: verde lima, fuente del sistema, `lucide-react`)

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (1) → Foundational (2) → historias de usuario → Polish (10).
- Foundational bloquea todas las historias.

### User story dependencies

- **US1 (P1)**: depende solo de Foundational. Es el MVP.
- **US2 (P1)**: depende de US1 (se integra en `Layout`).
- **US3 (P2)**: depende de US1 y de `PageHeader` (T028, dentro de la misma fase). T025–T026 (endpoint de resumen, aprobado) son backend de solo lectura; T027–T032 son frontend.
- **US4 (P2)**: depende de Foundational y de US1 (las pantallas viven dentro del Layout); usa `PageHeader` de T028 (hacer T028 antes de T033).
- **US5 (P3)**: independiente tras Foundational (el login no usa el Layout).
- **US6 (P3)**: depende de US1 y US2.
- **US7 (P3)**: depende de US1 (rutas) y de `Button`/`EmptyState`.

### Within each story

Pruebas primero cuando sea posible → componentes → pantallas → estilos → ejecutar `npm test`.

### Parallel opportunities

- Foundational: T005–T011 y T013 en paralelo (archivos distintos) tras T003–T004.
- US3: T025, T027 y T028 en paralelo; US5 puede avanzar en paralelo con US3/US4 si hay dos personas.
- US7 T045 y T046 en paralelo.
- Migraciones de pantallas US4 (T033–T038) son independientes entre sí tras T028.

### Parallel example: Foundational

```text
T005 Button    T006 Spinner/EmptyState    T007 Card/StatCard    T008 Badge
T009 FormField/Input/Select    T010 Table/Pagination    T011 ConfirmDialog
```

---

## Implementation Strategy

### MVP primero (US1 + US2)

1. Fases 1–2 (setup y fundamentos) → detenerse y probar.
2. Fase 3 (US1) → probar menú por rol → detenerse.
3. Fase 4 (US2) → estructura de navegación completa → demo.

### Entrega incremental

Después del MVP: US3 (inicio) → US4 (pantallas consistentes, la fase más grande; se puede dividir en lotes Usuarios / Clientes / Mi información) → US5 → US6 → US7 → Polish. Detenerse al final de cada fase para que el equipo pruebe, como indica CLAUDE.md.

---

## Notes

- Total: 53 tareas. Por fase: Setup 2, Foundational 11, US1 8, US2 3, US3 8 (T025–T026 son el endpoint de resumen aprobado), US4 7, US5 2, US6 3, US7 3, Polish 6.
- Solo T025–T026 tocan `backend/` (solo el endpoint de resumen, de solo lectura, aprobado el 2026-10-13); ninguna tarea modifica `database/`.
- Hacer commits pequeños por tarea o grupo lógico, en la rama de la funcionalidad.
