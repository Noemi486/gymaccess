# Feature Specification: Rediseño de interfaz: menú lateral y sistema visual

**Feature Branch**: `002-interfaz-menu-lateral`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Usa la descripción de docs/sprint-ui.md con el contexto de docs/project-context.md y CLAUDE.md"

## Clarifications

### Session 2026-10-13

- Q: ¿Qué color de acento debe usar la interfaz? → A: Verde lima
- Q: ¿Qué tipografía debe usar la interfaz? → A: Fuente del sistema (sin descargas externas)
- Cambio 2026-10-13 (Mi información y cuenta): "Mi información" muestra el número de cliente ("Cliente #0012"), el teléfono en grupos de 3 dígitos y un diseño de 2 columnas (perfil a la izquierda y tarjeta "Mi cuenta" a la derecha). Se agrega el cambio de contraseña para cualquier usuario autenticado, con el endpoint nuevo `PATCH /api/auth/password` aprobado por el equipo.
- Cambio 2026-10-13 (Login para todos los roles): el panel izquierdo del login se vuelve un carrusel automático de 3 diapositivas, porque el login lo usan todos los roles y no solo los clientes. Cada diapositiva tiene su frase en dos líneas (la segunda con degradado verde) y su propia ilustración de tarjetas; el formulario de la derecha no cambia.
- Cambio 2026-10-13 (Inicio de sesión): el login se rediseña con identidad propia de GymAccess (sin marcas, logos ni fotos de terceros): a la izquierda el logo, la frase "Entrena sin filas, / entra con tu rostro." y una ilustración hecha con HTML/CSS; a la derecha el formulario con campos redondeados, botón de ojo y la indicación de pedir a recepción el restablecimiento de la contraseña. No hay registro de cuenta nueva.
- Cambio 2026-10-13 (Inicio del entrenador): el Inicio del entrenador muestra saludo con fecha, buscador grande por nombre o apellido, dos indicadores (clientes activos y clientes nuevos de los últimos 7 días) y la lista "Clientes nuevos" con los últimos 5 registrados, siempre con la proyección básica (sin teléfono, correo, dirección ni información financiera); `GET /api/resumen` lo valida en el backend. Se anota el espacio para Sprint 2 ("clientes que entraron hoy") y Sprint 3 ("mis clientes asignados" y rutinas).
- Aprobación 2026-10-13: el equipo aprobó el endpoint de resumen `GET /api/resumen` (solo lectura, permisos por rol validados en el backend, pruebas sobre `gymaccess_test`), diseñado para que en Sprint 2 se le agreguen los indicadores de accesos de hoy y membresías por vencer.
- Cambio 2026-10-13 (Inicio): el Inicio deja de mostrar tarjetas de acceso rápido (repiten el menú) y pasa a ser un panel de resumen según el rol; se reserva el espacio para indicadores de Sprint 2.
- Ajuste 2026-10-13 (dirección de diseño del equipo): tipografía Inter incluida localmente con @fontsource/inter (aprobada por el equipo), acento verde lima #A3E635, menú fijo de 240 px, menú de usuario con avatar de iniciales en el encabezado, tarjetas grandes de acceso rápido y login dividido en dos paneles.
- Q: ¿Qué debe mostrar el menú como nombre o logotipo de texto? → A: "GymAccess" con un ícono de pesa o rayo

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Menú lateral según el rol (Priority: P1)

Como usuario del sistema, quiero un menú lateral con las secciones que mi rol puede usar, para moverme entre módulos sin regresar a la pantalla de inicio.

**Why this priority**: Es la estructura de navegación de la que dependen todas las demás pantallas, actuales y futuras (Sprint 2). Sin ella el sistema es una lista de enlaces sin orden.

**Independent Test**: Iniciar sesión con cada uno de los cuatro roles y comprobar que el menú muestra exactamente las secciones permitidas, que la sección actual aparece resaltada y que se puede navegar entre ellas sin pasar por el inicio.

**Acceptance Scenarios**:

1. **Given** un administrador con sesión iniciada, **When** abre cualquier pantalla, **Then** el menú muestra Inicio, Clientes y Usuarios y roles, agrupados en bloques con encabezado (General, Operación, Administración).
2. **Given** un recepcionista con sesión iniciada, **When** abre cualquier pantalla, **Then** el menú muestra Inicio y Clientes, y no muestra Usuarios y roles.
3. **Given** un entrenador con sesión iniciada, **When** abre cualquier pantalla, **Then** el menú muestra Inicio y Clientes (solo consulta).
4. **Given** un cliente con sesión iniciada, **When** abre cualquier pantalla, **Then** el menú muestra Inicio y Mi información, y no muestra Clientes ni Usuarios y roles.
5. **Given** un usuario en la sección Clientes, **When** observa el menú, **Then** la opción Clientes aparece resaltada como sección activa.
6. **Given** un usuario sin permiso para una sección, **When** escribe directamente su dirección, **Then** ve la página "Sin permiso" y el sistema sigue negando el acceso a los datos.

---

### User Story 2 - Encabezado con la sesión (Priority: P1)

Como usuario, quiero ver en la parte superior el nombre de la sección en la que estoy, mi nombre, mi rol y un botón para cerrar sesión.

**Why this priority**: Es parte de la estructura común y confirma al usuario quién está en sesión, algo necesario en un equipo compartido de recepción.

**Independent Test**: Iniciar sesión, navegar por varias secciones y verificar que el encabezado cambia el título, conserva nombre y rol, y que cerrar sesión regresa a la pantalla de inicio de sesión.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión iniciada, **When** abre cualquier sección, **Then** el encabezado muestra el título de esa sección, su nombre y su rol.
2. **Given** un usuario con sesión iniciada, **When** abre el menú de usuario (avatar) y elige "Cerrar sesión", **Then** la sesión termina y se muestra la pantalla de inicio de sesión.

---

### User Story 3 - Inicio como panel de resumen por rol (Priority: P2)

Como usuario, quiero que la pantalla de inicio me salude con la fecha de hoy y me muestre un resumen útil para mi rol (indicadores, últimos registros y un buscador de clientes), en lugar de repetir los enlaces del menú lateral.

**Why this priority**: Da valor inmediato al entrar al sistema y evita duplicar la navegación, pero el sistema es utilizable sin ella gracias al menú.

**Independent Test**: Abrir el inicio con cada rol y verificar que aparece el saludo con la fecha y solo el contenido de su rol; que los indicadores coinciden con los datos de la lista de clientes/usuarios; y que el buscador lleva a la lista de clientes con el texto escrito.

**Acceptance Scenarios**:

1. **Given** un administrador en el inicio, **When** se carga la pantalla, **Then** ve el saludo con la fecha, el botón principal "+ Registrar cliente", 4 indicadores (clientes activos, clientes inactivos, registrados este mes, usuarios del sistema), una tabla con los últimos 5 clientes registrados y la cantidad de usuarios por rol.
2. **Given** un recepcionista en el inicio, **When** se carga la pantalla, **Then** ve el saludo con la fecha, el botón "+ Registrar cliente", un buscador grande de clientes, los indicadores de clientes activos y registrados hoy, y los últimos 5 clientes registrados.
3. **Given** un entrenador en el inicio, **When** se carga la pantalla, **Then** ve el saludo con la fecha, el buscador de clientes por nombre o apellido, dos indicadores (clientes activos y clientes nuevos de los últimos 7 días) y la lista "Clientes nuevos" con los últimos 5 registrados (avatar de iniciales, nombre completo, insignia de estado y fecha de registro); no ve el botón "+ Registrar cliente" y nunca ve teléfono, correo, dirección ni información financiera.
4. **Given** un cliente en el inicio, **When** se carga la pantalla, **Then** ve el saludo con la fecha y una tarjeta compacta con su nombre completo, su estado y su correo, y un botón "Ver mi información" que lleva al detalle; no ve indicadores de otros clientes, ni botón de registro, ni (todavía) las tarjetas de Sprint 2.
5. **Given** un recepcionista o entrenador que escribe un texto en el buscador, **When** lo envía, **Then** navega a la lista de clientes con ese texto ya aplicado como búsqueda.
6. **Given** un administrador o recepcionista, **When** pulsa "+ Registrar cliente", **Then** navega al formulario de registro de cliente.
7. **Given** un usuario en el inicio, **When** no pueden cargarse los datos del resumen, **Then** ve un aviso de error claro y el resto de la pantalla (saludo y acciones) sigue disponible.

---

### User Story 4 - Pantallas consistentes (Priority: P2)

Como usuario, quiero que todas las pantallas (listas, formularios, detalle) usen el mismo estilo de títulos, botones, tablas, formularios y mensajes, para que el sistema se sienta como una sola aplicación.

**Why this priority**: Es el núcleo del sistema visual y cumple el Principio XI de la constitución; se aplica sobre las pantallas de Sprint 1 y queda como base para Sprint 2.

**Independent Test**: Recorrer Usuarios, Clientes (lista, registro, edición y detalle) y Mi información, y verificar que comparten estilo, que las listas tienen estado vacío y paginación, que los formularios muestran errores por campo y estado de carga al guardar, y que los estados se muestran con insignias de color y texto.

**Acceptance Scenarios**:

1. **Given** una lista de usuarios o clientes sin resultados, **When** se muestra, **Then** aparece un mensaje de estado vacío claro en lugar de una tabla en blanco.
2. **Given** una lista con más registros que los de una página, **When** se muestra, **Then** la paginación es visible y funcional.
3. **Given** un formulario con datos inválidos, **When** el usuario intenta guardar, **Then** cada campo con problema muestra su propio mensaje de error en español.
4. **Given** un formulario válido, **When** el usuario pulsa guardar, **Then** el botón muestra un estado de carga mientras se procesa y después aparece un aviso de éxito o de error.
5. **Given** un cliente o usuario activo o inactivo, **When** se muestra su estado, **Then** se presenta con una insignia que combina color y texto.
6. **Given** una baja o inactivación, **When** el usuario la solicita, **Then** el sistema pide confirmación antes de ejecutarla.

---

### User Story 5 - Pantalla de inicio de sesión con identidad (Priority: P3)

Como usuario, quiero una pantalla de inicio de sesión clara y con la identidad de GymAccess.

**Why this priority**: Es la puerta de entrada y refuerza la identidad, pero no cambia la funcionalidad.

**Independent Test**: Abrir el sistema sin sesión y verificar la pantalla de dos paneles (marca, frase e ilustración a la izquierda; formulario a la derecha), mostrar y ocultar la contraseña, y mensajes claros ante credenciales incorrectas; reducir la ventana y comprobar que queda solo el logo y el formulario.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión en una pantalla ancha, **When** abre el sistema, **Then** ve la pantalla de inicio de sesión dividida en dos paneles: a la izquierda el logo GymAccess arriba y, centrado, un carrusel de 3 diapositivas; a la derecha el formulario. El carrusel habla a todos los roles (personal y clientes), no solo a los clientes.
2. **Given** el carrusel, **When** se muestran sus diapositivas, **Then** cada una tiene una frase grande en dos líneas con la segunda en degradado de verde lima a verde, y su propia ilustración, hecha solo con HTML/CSS y los componentes del sistema (sin imágenes, marcas ni logos de terceros), con tarjetas encimadas e inclinadas, sombras suaves y datos de ejemplo:
   - Diapositiva 1, "Controla quién entra, / sin filas.": una tarjeta con un rostro estilizado (ícono de reconocimiento facial) rodeado de esquinas de escáner en verde y el nombre "Min Cabrera", la burbuja verde "Acceso autorizado" con una marca de verificación y la tarjeta de indicador "128 accesos hoy".
   - Diapositiva 2, "Membresías y pagos, / siempre al día.": la tarjeta "Plan Mensual" con la insignia "Vigente", la tarjeta "Pago registrado $450" y la tarjeta "3 membresías por vencer" en amarillo.
   - Diapositiva 3, "Consulta tu membresía / y tus visitas.": una tarjeta de perfil con el avatar "MC" y "Min Cabrera", la tarjeta "Vence en 18 días" con una barra de progreso y una lista pequeña "Últimas visitas".
3. **Given** el carrusel, **When** pasa el tiempo, **Then** cambia de diapositiva solo cada 5 segundos con una transición suave y vuelve a la primera al terminar; se pausa mientras el mouse está encima (o un punto tiene el foco del teclado); y muestra indicadores de puntos clicables, uno por diapositiva, que llevan a esa diapositiva, marcan la actual y reinician la cuenta.
4. **Given** un visitante que prefiere menos movimiento (`prefers-reduced-motion`), **When** abre el login, **Then** el carrusel muestra solo la primera diapositiva, sin cambios automáticos ni puntos, y las ilustraciones no se animan.
5. **Given** las ilustraciones, **When** se usan lectores de pantalla o el teclado, **Then** son decorativas: solo la frase de la diapositiva visible se anuncia, y las demás diapositivas y sus datos de ejemplo quedan ocultos.
6. **Given** el panel derecho, **When** el visitante lo mira, **Then** ve el título "Iniciar sesión en GymAccess", los campos de correo y contraseña con bordes muy redondeados y los textos de ejemplo "Correo electrónico" y "Contraseña" (cada campo conserva una etiqueta accesible), un botón con ícono de ojo para mostrar u ocultar la contraseña, el botón principal "Iniciar sesión" de ancho completo y redondeado, y debajo el texto "¿Olvidaste tu contraseña? Pide a recepción que la restablezca."; no hay registro de cuenta nueva (solo el administrador crea cuentas).
7. **Given** el campo Contraseña, **When** el visitante usa el botón de ojo (con ratón o con teclado), **Then** la contraseña se muestra u oculta, el botón anuncia su estado y lo escrito se conserva.
8. **Given** una pantalla pequeña, **When** el visitante abre el sistema, **Then** se oculta el panel de marca y la ilustración, y queda solo el formulario con el logo arriba.
9. **Given** credenciales incorrectas, **When** intenta iniciar sesión, **Then** ve un mensaje de error claro sin revelar información interna.

---

### User Story 6 - Uso en laptop pequeña o tableta (Priority: P3)

Como recepcionista, quiero poder usar el sistema en una laptop pequeña o tableta, con un menú que se pueda ocultar.

**Why this priority**: Amplía los dispositivos de uso en recepción, pero el escritorio es el caso principal.

**Independent Test**: Reducir el ancho de la ventana por debajo de 1024 px y verificar que el menú se oculta, puede mostrarse de nuevo y que el contenido sigue siendo legible sin desplazamiento horizontal de la página.

**Acceptance Scenarios**:

1. **Given** una pantalla de menos de 1024 px de ancho, **When** se abre el sistema, **Then** el menú aparece oculto y existe un control visible para mostrarlo.
2. **Given** el menú mostrado en pantalla pequeña, **When** el usuario elige una sección o lo oculta, **Then** el menú se cierra y el contenido queda visible.
3. **Given** una pantalla de 1024 px o más, **When** se abre el sistema, **Then** el menú permanece visible.

---

### User Story 7 - Páginas "No encontrado" y "Sin permiso" (Priority: P3)

Como usuario, quiero ver una página clara cuando entro a una dirección que no existe o a la que no tengo permiso, para saber qué ocurrió y cómo volver.

**Why this priority**: Completa la experiencia y evita pantallas en blanco, pero se usa en pocos casos.

**Independent Test**: Abrir una dirección inexistente y una dirección de una sección sin permiso y verificar que se muestra la página correspondiente dentro de la estructura común, con una opción para volver al inicio.

**Acceptance Scenarios**:

1. **Given** un usuario con sesión, **When** abre una dirección inexistente, **Then** ve la página "No encontrado" con una opción para volver al inicio.
2. **Given** un usuario con sesión, **When** abre una sección que su rol no permite, **Then** ve la página "Sin permiso" con una opción para volver al inicio.

---

### User Story 8 - Cuenta y cambio de contraseña (Priority: P2)

Como usuario autenticado de cualquier rol, quiero cambiar mi contraseña desde el sistema, para mantener segura mi cuenta sin pedir ayuda al administrador.

**Why this priority**: Es una necesidad básica de seguridad de cuentas (Principio V) y se ofrece en dos lugares de la interfaz nueva: el menú del avatar y la tarjeta "Mi cuenta".

**Independent Test**: Con cualquier rol, abrir el diálogo desde el menú del avatar, cambiar la contraseña, cerrar sesión e iniciar sesión con la nueva; comprobar que la anterior ya no funciona y que los errores se muestran junto a cada campo.

**Acceptance Scenarios**:

1. **Given** un usuario de cualquier rol con sesión iniciada, **When** abre el menú del avatar, **Then** ve la opción "Cambiar contraseña", que abre un diálogo con tres campos: contraseña actual, nueva y confirmación.
2. **Given** un cliente en "Mi información", **When** observa la tarjeta "Mi cuenta", **Then** ve su correo de acceso y un botón "Cambiar contraseña" que abre el mismo diálogo.
3. **Given** el diálogo abierto, **When** el usuario escribe su contraseña actual correcta y una nueva que cumple la política (8 a 72 caracteres, al menos una letra y un número) con su confirmación, **Then** el sistema guarda la nueva contraseña, cierra el diálogo y muestra el aviso "Contraseña actualizada correctamente."
4. **Given** el diálogo abierto, **When** la contraseña actual es incorrecta, **Then** el campo "contraseña actual" muestra "La contraseña actual no es correcta." y no se cambia nada.
5. **Given** el diálogo abierto, **When** la nueva contraseña no cumple la política, es igual a la actual o no coincide con la confirmación, **Then** el campo correspondiente muestra un mensaje claro y no se cambia nada.
6. **Given** una contraseña cambiada, **When** el usuario inicia sesión de nuevo, **Then** solo funciona la contraseña nueva.
7. **Given** demasiados intentos fallidos de contraseña actual, **When** vuelve a intentar, **Then** el sistema bloquea temporalmente los intentos con un mensaje claro.

---

### Edge Cases

- ¿Qué pasa cuando el nombre o correo del usuario es muy largo? El encabezado lo recorta sin romper el diseño.
- ¿Qué pasa con una lista con muchos registros? El encabezado de la tabla permanece visible y la paginación sigue accesible.
- ¿Qué pasa si la sesión expira mientras se usa el sistema? Se regresa a inicio de sesión con un aviso claro.
- ¿Qué pasa si una operación falla por un error del servidor? Se muestra un aviso de error comprensible, sin detalles técnicos internos.
- ¿Qué pasa si aún no hay clientes registrados? Los indicadores muestran 0 y la tabla de últimos registros muestra un estado vacío con una invitación a registrar el primer cliente (si el rol puede hacerlo).
- ¿Qué pasa si el usuario cierra el diálogo de contraseña con datos escritos? Se descartan y no se envía nada; al reabrirlo los campos están vacíos.
- ¿Qué pasa al recargar la página estando en una sección? Se conserva la sesión y la sección activa permanece resaltada.
- ¿Qué pasa al cambiar el tamaño de la ventana con el menú abierto? El menú se adapta al nuevo ancho sin perder la posición del usuario.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Todas las pantallas autenticadas DEBEN mostrarse dentro de una misma estructura común con menú lateral, encabezado y área de contenido.
- **FR-002**: El menú lateral DEBE mostrar únicamente las secciones permitidas para el rol del usuario en sesión, según la tabla del Anexo (Inicio, Clientes, Usuarios y roles, Mi información).
- **FR-003**: El menú DEBE mostrar en su parte superior el logotipo "GymAccess" con un ícono de pesa o rayo, agruparse en bloques con encabezado pequeño (General, Operación, Administración) y DEBE resaltar la sección activa.
- **FR-004**: Las secciones de Sprint 2 (Membresías, Pagos, Control de acceso) NO DEBEN mostrarse todavía; el menú DEBE definirse a partir de una configuración (sección, ícono, ruta, roles permitidos, bloque) de modo que agregar una sección futura solo requiera añadir una entrada.
- **FR-005**: El menú DEBE poder ocultarse y mostrarse en pantallas de menos de 1024 px de ancho, y permanecer visible en pantallas de 1024 px o más.
- **FR-006**: El encabezado DEBE mostrar el título de la sección actual y un menú de usuario con avatar de iniciales, el nombre y el rol del usuario, desde el cual se cierra la sesión.
- **FR-007**: La pantalla de inicio DEBE ser un panel de resumen por rol (sin tarjetas de acceso rápido que repitan el menú): saludo con la fecha de hoy y, solo para administrador y recepcionista, un único botón principal "+ Registrar cliente". Contenido por rol: administrador (4 indicadores: clientes activos, clientes inactivos, registrados este mes y usuarios del sistema; tabla de los últimos 5 clientes registrados; cantidad de usuarios por rol); recepcionista (buscador grande de clientes, indicadores de clientes activos y registrados hoy, últimos 5 clientes registrados); entrenador (saludo con fecha, buscador de clientes por nombre o apellido, indicadores de clientes activos y clientes nuevos de los últimos 7 días, y la lista "Clientes nuevos" con los últimos 5 registrados; ver FR-028); cliente (una tarjeta compacta con su nombre completo, estado y correo, y el botón "Ver mi información" para el detalle).
- **FR-008**: Todas las pantallas rediseñadas (Inicio de sesión, Inicio, Usuarios lista y formulario, Clientes lista/registro/edición/detalle, Mi información, No encontrado, Sin permiso) DEBEN compartir el mismo estilo de títulos, botones, tablas, formularios, tarjetas y mensajes.
- **FR-009**: Las listas de usuarios y clientes DEBEN mostrar un estado vacío claro y una paginación visible, y su encabezado de tabla DEBE permanecer visible al desplazarse.
- **FR-010**: Los formularios DEBEN mostrar etiqueta, ayuda y error por campo, y un estado de carga en el botón de guardar mientras se procesa.
- **FR-011**: Los estados (activo, inactivo) DEBEN mostrarse con insignias que combinen color y texto, nunca solo color; el sistema visual DEBE contemplar también los estados de Sprint 2 (vigente, vencida, suspendida, cancelada, autorizado, rechazado).
- **FR-012**: Toda acción de guardado, edición, alta o baja DEBE mostrar un aviso de éxito o de error.
- **FR-013**: Las bajas e inactivaciones DEBEN pedir confirmación antes de ejecutarse.
- **FR-014**: DEBEN existir las páginas "No encontrado" y "Sin permiso", con una opción para volver al inicio.
- **FR-015**: Todos los colores, tamaños de letra, espacios y radios DEBEN definirse una sola vez como valores globales reutilizables; ninguna pantalla DEBE definir colores propios.
- **FR-016**: El sistema DEBE usar la fuente Inter, incluida con la aplicación (sin descargar fuentes externas), un tema oscuro como predeterminado, con el verde lima como color de acento, usado con moderación (botón principal, opción activa del menú, elementos destacados) y contraste de texto legible.
- **FR-017**: Debe existir un conjunto de elementos visuales reutilizables (estructura, menú, encabezado, cabecera de página, tarjetas, botones con variantes y estado de carga, campos de formulario, tablas, insignias, avisos, diálogo de confirmación, estado vacío e indicador de carga) usados en todas las pantallas actuales y disponibles para Sprint 2.
- **FR-018**: Los textos de la interfaz DEBEN estar en español.
- **FR-019**: El rediseño NO DEBE modificar los endpoints existentes, las validaciones del servidor, las reglas de negocio ni la base de datos; las rutas protegidas y la validación de permisos en el servidor se mantienen, y ocultar una opción del menú no sustituye esa validación. Las únicas adiciones en el servidor son dos endpoints nuevos aprobados por el equipo el 2026-10-13: el de resumen del inicio (solo lectura, FR-021) y el de cambio de contraseña (FR-026).
- **FR-020**: Las pruebas existentes del frontend DEBEN actualizarse a la nueva estructura y seguir pasando, y las pruebas del backend DEBEN seguir pasando sin cambios.
- **FR-021**: Los datos del resumen DEBEN provenir de los datos reales del sistema y cada rol DEBE recibir únicamente lo que su rol puede consultar (el entrenador no recibe datos de contacto ni cifras de usuarios; el cliente no recibe datos de otros clientes). Si se crea un endpoint de resumen, DEBE ser de solo lectura, validar el rol en el servidor, rechazar al rol cliente y contar con pruebas sobre la base `gymaccess_test`.
- **FR-022**: El inicio DEBE dejar preparado el espacio para indicadores de Sprint 2 (accesos de hoy y membresías por vencer) sin mostrarlos todavía, de modo que agregarlos requiera solo añadir una entrada a su configuración.
- **FR-023**: El Inicio del cliente DEBE dejar reservado el espacio de un panel para las tarjetas de Sprint 2 (Mi membresía, Acceso facial, Mis últimas visitas y Mis pagos) sin mostrarlas todavía; su diseño queda anotado en el Anexo "Diseño reservado para Sprint 2: Inicio del cliente" y agregarlas debe requerir solo declararlas disponibles en su configuración.
- **FR-024**: "Mi información" y el detalle de cliente DEBEN compartir un mismo perfil: encabezado con avatar grande de iniciales, nombre completo, insignia de estado y el texto "Cliente desde <fecha>"; debajo, los datos en una cuadrícula de 2 columnas (1 columna en pantallas pequeñas), cada uno con ícono, etiqueta pequeña en gris y valor. En "Mi información" el aviso de que los datos incorrectos se corrigen en recepción se muestra en una caja informativa con ícono.
- **FR-025**: El perfil (en "Mi información" y en el detalle de cliente) DEBE mostrar el número de cliente con el formato "Cliente #0012" (mínimo 4 dígitos, con ceros a la izquierda) junto a "Cliente desde <fecha>", y el teléfono en grupos de 3 dígitos (el último grupo absorbe un dígito sobrante, por ejemplo "555 100 2000"). En pantallas grandes, "Mi información" DEBE usar 2 columnas: el perfil a la izquierda y la tarjeta "Mi cuenta" a la derecha, con el correo de acceso y el botón "Cambiar contraseña"; en pantallas pequeñas, una sola columna.
- **FR-026**: Cualquier usuario autenticado DEBE poder cambiar su contraseña desde un diálogo con contraseña actual, nueva y confirmación. El servidor DEBE validar la contraseña actual con bcrypt, aplicar la misma política de contraseñas que el alta de usuarios, exigir que la nueva sea distinta de la actual y coincida con la confirmación, guardar solo el hash de la nueva y responder con un mensaje claro; los intentos fallidos repetidos de contraseña actual DEBEN bloquearse temporalmente. El error de contraseña actual incorrecta NO DEBE cerrar la sesión.
- **FR-027**: La opción "Cambiar contraseña" DEBE estar en el menú del avatar del encabezado para todos los roles.
- **FR-028**: El Inicio del entrenador DEBE mostrar únicamente la proyección básica del cliente (identificador, nombre, apellido, estado y fecha de registro): nunca teléfono, correo, dirección ni información financiera (pagos, adeudos, ingresos). Esta restricción DEBE aplicarse en el servidor: `GET /api/resumen` solo entrega al entrenador los clientes activos, los clientes nuevos de los últimos 7 días (hoy y los 6 días anteriores) y los últimos 5 clientes registrados con la proyección básica, y NO le entrega cifras de usuarios; las pruebas sobre `gymaccess_test` lo verifican. La lista "Clientes nuevos" muestra para cada cliente avatar de iniciales, nombre completo, insignia de estado y fecha de registro, y su nombre enlaza al detalle.
- **FR-029**: La pantalla de inicio de sesión DEBE tener identidad propia de GymAccess, sin marcas, logos ni fotos de terceros. Su panel izquierdo DEBE ser un carrusel automático de 3 diapositivas dirigido a todos los roles, con frase en dos líneas (la segunda con degradado verde) y una ilustración propia por diapositiva hecha solo con HTML/CSS y los componentes del sistema; DEBE cambiar cada 5 segundos con transición suave, pausarse con el mouse o el foco, ofrecer puntos clicables y, con movimiento reducido, mostrar solo la primera diapositiva sin animaciones. Las ilustraciones son decorativas (ocultas a lectores de pantalla y al teclado). El formulario DEBE ser accesible aunque use textos de ejemplo en lugar de etiquetas visibles, NO DEBE ofrecer registro de cuenta nueva y DEBE indicar que el restablecimiento de la contraseña se pide a recepción.

### Key Entities *(include if feature involves data)*

- **Sección de menú**: Entrada de navegación con nombre, ícono, ruta, bloque al que pertenece y roles que pueden verlo. La lista completa de secciones es la configuración del menú.
- **Usuario en sesión**: Nombre y rol que determinan qué secciones del menú y qué resumen del inicio se muestran. No se crean ni modifican datos de negocio.
- **Cuenta de acceso**: Correo de acceso y contraseña (guardada solo como hash) del usuario en sesión; el cambio de contraseña actualiza únicamente el hash.
- **Cliente nuevo (vista del entrenador)**: Cliente registrado recientemente, con solo identificador, nombre, apellido, estado y fecha de registro.
- **Indicador de resumen**: Cifra del inicio (por ejemplo, clientes activos) con su etiqueta, visible según el rol. Los de Sprint 2 (accesos de hoy, membresías por vencer) están reservados en la configuración pero no se muestran todavía.
- **Tarjeta del cliente (Sprint 2, reservada)**: Tarjeta del Inicio del cliente con información propia de su membresía, rostro, visitas o pagos. No se muestran todavía.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las pantallas autenticadas existentes se muestran dentro de la estructura común con menú y encabezado.
- **SC-002**: Para cada uno de los 4 roles, el menú muestra exactamente las secciones permitidas y ninguna otra.
- **SC-003**: Un usuario llega a cualquier sección permitida en un máximo de 1 clic desde cualquier pantalla (menú lateral), y a "Registrar cliente" en 1 clic desde el inicio (administrador y recepcionista).
- **SC-004**: Agregar una sección nueva al menú requiere modificar un único lugar de la configuración y ninguna pantalla existente.
- **SC-005**: Ninguna pantalla define colores propios: el 100 % de los colores proviene de los valores globales definidos una sola vez.
- **SC-006**: Entre 360 px y 1920 px de ancho, ninguna pantalla rediseñada requiere desplazamiento horizontal de la página; y por debajo de 1024 px el menú puede ocultarse y mostrarse.
- **SC-007**: El 100 % de las acciones de guardado y baja muestran un aviso de éxito o error, y el 100 % de las bajas pide confirmación.
- **SC-008**: Todos los estados se identifican sin depender solo del color (texto presente en el 100 % de las insignias).
- **SC-009**: Un recepcionista nuevo identifica cómo llegar a Clientes y a la acción "Registrar cliente" en menos de 30 segundos sin ayuda.
- **SC-010**: Todas las pruebas existentes del frontend y del backend pasan tras el rediseño.
- **SC-011**: Las cifras del resumen coinciden con los datos reales: el 100 % de los indicadores de las pruebas coincide con los conteos de la lista de clientes y de usuarios.
- **SC-012**: Un usuario cambia su contraseña en menos de 1 minuto desde el menú del avatar, y el 100 % de los intentos con contraseña actual incorrecta o nueva inválida se rechaza sin cambiar la cuenta.

## Assumptions

- Es un rediseño del frontend. El resumen del inicio necesita datos que los endpoints actuales no entregan (últimos clientes registrados y conteos de registrados hoy/este mes); por eso se propone un único endpoint nuevo de solo lectura, aprobado por el equipo el 2026-10-13 (Principios I, II y V). Sin él, el inicio solo podría mostrar conteos por estado y por rol.
- El cambio de contraseña no invalida la sesión abierta ni otras sesiones (el sistema no guarda sesiones en el servidor); la nueva contraseña rige desde el siguiente inicio de sesión. El restablecimiento por olvido de contraseña queda fuera de alcance.
- "Hoy" y "este mes" se calculan con la fecha del servidor (zona horaria local del gimnasio).
- Las secciones de Sprint 2 (Membresías, Pagos, Control de acceso) quedan fuera de este alcance; solo se deja el menú y los estados visuales preparados.
- El logotipo del menú es el texto "GymAccess" acompañado de un ícono de pesa o rayo. El color de acento ya está definido (verde lima) y la tipografía es Inter incluida localmente, para que se vea igual en todos los equipos y funcione sin internet.
- Se permite añadir una única librería ligera de íconos, justificada por la mejora de lectura del menú y los botones; no se añadirá ninguna librería de componentes completa (Principio III).
- El tema claro/oscuro intercambiable, las gráficas del dashboard (Sprint 3) y cualquier función de Sprint 2 quedan fuera de alcance.
- Se parte de las pantallas, rutas protegidas y pruebas existentes de `specs/001-base-usuarios-clientes/`.
- El uso previsto es en navegador de escritorio, laptop pequeña y tableta; no se contempla una aplicación móvil independiente.

## Anexo: Menú por rol

| Sección | Administrador | Recepcionista | Entrenador | Cliente |
|---|---|---|---|---|
| Inicio | Sí | Sí | Sí | Sí |
| Clientes | Sí | Sí | Sí (solo consulta) | No |
| Usuarios y roles | Sí | No | No | No |
| Mi información | No | No | No | Sí |

## Anexo: Diseño reservado para Sprint 2: Inicio del cliente

Estas tarjetas **NO se muestran en esta entrega**. Se anota su diseño para que Sprint 2 las construya sobre el espacio ya reservado en el Inicio del cliente (debajo de la tarjeta compacta de información). Cada tarjeta muestra únicamente datos del propio cliente (RN-14) y sigue las reglas visuales del sistema: el estado se indica con color **y** texto (FR-011), y los colores salen de los tokens de diseño.

**Distribución**: cuadrícula de 2 columnas en pantallas anchas y 1 columna por debajo de 1024 px. Orden: Mi membresía, Acceso facial, Mis últimas visitas, Mis pagos. Cada tarjeta tiene título, contenido y, si hay más información, un enlace "Ver todo".

| Tarjeta | Contenido | Reglas visuales |
|---|---|---|
| **Mi membresía** | Plan (tipo de membresía), estado, fecha de vencimiento y días restantes con una barra de progreso (días restantes sobre la duración total del plan). | Barra y texto en verde mientras la membresía sea vigente y le falten más de 5 días; en **amarillo** cuando faltan 5 días o menos; en **rojo** cuando está vencida. El texto acompaña siempre al color: "Vence en N días" / "Vence hoy" / "Vencida hace N días". Si no tiene membresía: estado vacío "Aún no tienes una membresía". |
| **Acceso facial** | Si el rostro está registrado: Sí / No. | Insignia con texto "Registrado" (verde) o "No registrado" (neutral). Si no está registrado: "Pide a recepción que registre tu rostro". No se muestra ningún dato biométrico. |
| **Mis últimas visitas** | Los últimos accesos (5): fecha y hora, resultado y, si fue rechazado, el motivo. | Insignia "Autorizado" (verde) o "Rechazado" (rojo) con el motivo en texto junto al registro. Sin accesos: estado vacío "Aún no tienes visitas registradas". |
| **Mis pagos** | Los últimos pagos (5): fecha, monto, método y estado, y el adeudo actual. | El adeudo se destaca: "Sin adeudo" (verde) o el monto pendiente (rojo). Sin pagos: estado vacío "Aún no tienes pagos registrados". |

**Cómo se activa en Sprint 2**: cada tarjeta se declara en `frontend/src/config/tarjetasCliente.js` (hoy con `disponible: false` y sin componente). Para mostrarla basta con crear su componente, asignarlo en esa entrada y marcarla como disponible. Los datos saldrán de los endpoints de Sprint 2 con permisos validados en el backend (el cliente solo consulta lo propio).

## Anexo: Espacio reservado para Sprint 2 y Sprint 3: Inicio del entrenador

Estas tarjetas **NO se muestran en esta entrega**. Se anota dónde irán para que los sprints siguientes las agreguen sin rediseñar el Inicio. El Inicio del entrenador se compone, de arriba abajo, de: saludo con fecha, buscador, fila de indicadores y panel de listas. Los nuevos elementos usan esos mismos huecos y, como todo lo del entrenador, solo pueden mostrar la proyección básica del cliente (sin teléfono, correo, dirección ni datos financieros); los permisos se validan en el backend.

| Sprint | Elemento | Dónde va | Contenido previsto |
|---|---|---|---|
| Sprint 2 | **Clientes que entraron hoy** (indicador y lista) | Un tercer indicador en la fila de indicadores y una lista junto a "Clientes nuevos" | Cantidad de clientes con acceso autorizado hoy y la lista de los últimos que entraron (avatar de iniciales, nombre completo y hora de entrada). No muestra motivos de rechazo ni datos financieros. |
| Sprint 3 | **Mis clientes asignados** | Una lista nueva en el panel, antes de "Clientes nuevos" | Los clientes asignados al entrenador (avatar, nombre completo, estado), con enlace al detalle. |
| Sprint 3 | **Rutinas** | Una tarjeta en el panel, junto a "Mis clientes asignados" | Acceso a las rutinas de los clientes asignados y número de rutinas pendientes por revisar. |

**Cómo se activan**: el indicador se declara en `frontend/src/config/indicadores.js` (para el entrenador) y la información sale de `GET /api/resumen`, que arma su respuesta con una lista de entradas por rol; agregar un elemento es sumar una entrada en el servidor y otra en la configuración, sin cambiar las existentes.
