# Feature Specification: Base del sistema, usuarios y clientes (Sprint 1)

**Feature Branch**: `001-base-usuarios-clientes`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Usa la descripción de docs/sprint-1.md con el contexto de docs/project-context.md. La base de datos gymaccess ya existe en MySQL con sus 8 tablas; el backend se conecta con el usuario gymaccess_app."

## Clarifications

### Session 2026-10-07

- Q: ¿Qué datos de un cliente puede ver el entrenador cuando consulta "la información básica"? → A: Nombre, apellido, estado del cliente y fecha de registro (sin teléfono, correo ni dirección).
- Q: ¿Quién puede dar de baja o reactivar a un cliente? → A: Solo el administrador.
- Q: ¿Qué debe pasar tras varios intentos fallidos de inicio de sesión en la misma cuenta? → A: Bloqueo temporal de 15 minutos tras 5 intentos fallidos seguidos.
- Q: ¿Qué regla mínima debe cumplir la contraseña de un usuario nuevo? → A: Mínimo 8 caracteres, con al menos una letra y un número.
- Q: ¿Quién crea la cuenta de acceso de un cliente y cuándo? → A: Solo el administrador, de forma opcional, para un cliente ya registrado que tenga correo.
- Q: ¿Puede iniciar sesión un cliente dado de baja (estado inactivo)? → A: No. Un cliente dado de baja no puede iniciar sesión ni usar una sesión abierta; al reactivarlo recupera el acceso con la misma cuenta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inicio de sesión con control por rol (Priority: P1)

Un usuario registrado (administrador, recepcionista, entrenador o cliente) ingresa su correo y contraseña para acceder al sistema. Tras autenticarse, el sistema identifica su rol y le permite usar únicamente las funciones que le corresponden.

**Why this priority**: Sin autenticación y control por rol no puede usarse ninguna otra función del sistema; es la base de toda la seguridad.

**Independent Test**: Con un usuario ya existente de cada rol, iniciar sesión con credenciales válidas e inválidas y verificar que las funciones protegidas solo responden al rol correcto.

**Acceptance Scenarios**:

1. **Cuando** un usuario activo envíe un correo y una contraseña válidos, **el sistema debe** iniciar su sesión, identificar su rol y entregarle una credencial de sesión con vigencia de 8 horas.
2. **Si** el correo o la contraseña son incorrectos, **entonces el sistema debe** rechazar el acceso con código 401 y un mensaje idéntico en ambos casos, de modo que no revele si el correo existe.
3. **Mientras** una persona no tenga una sesión válida (sin credencial, vencida o manipulada), **el sistema debe** responder 401 a cualquier función protegida.
4. **Si** un usuario autenticado solicita una función que su rol no permite, **entonces el sistema debe** rechazarla con código 403, incluso cuando la solicitud llegue directamente al servidor sin pasar por la interfaz.
5. **Si** un usuario desactivado intenta iniciar sesión, **entonces el sistema debe** negarle el acceso con código 401, aunque la contraseña sea correcta.
6. **Si** una cuenta acumula 5 intentos fallidos seguidos, **entonces el sistema debe** rechazar con código 423 y un mensaje genérico de bloqueo temporal todo inicio de sesión de esa cuenta durante los siguientes 15 minutos, aunque la contraseña sea correcta.
7. **Cuando** transcurran 15 minutos desde el bloqueo de una cuenta, **el sistema debe** permitirle iniciar sesión con credenciales válidas y reiniciar su conteo de intentos fallidos a 0.
8. **Si** un cliente dado de baja (estado inactivo) con cuenta de acceso intenta iniciar sesión con credenciales correctas, **entonces el sistema debe** negarle el acceso con código 401 y el mismo mensaje genérico de credenciales incorrectas.
9. **Mientras** un cliente tenga la sesión abierta y el administrador lo dé de baja, **el sistema debe** responder 401 a su siguiente petición, aunque su credencial de 8 horas aún no haya vencido.

---

### User Story 2 - Administración de usuarios y roles (Priority: P2)

El administrador registra nuevas cuentas para el personal autorizado, consulta y modifica las existentes, y asigna a cada una un rol (administrador, recepcionista, entrenador o cliente). También puede activar o desactivar cuentas.

**Why this priority**: Permite dar de alta al personal que operará el sistema; depende del inicio de sesión (P1).

**Independent Test**: Iniciar sesión como administrador, crear un usuario con rol recepcionista, cambiarle el rol, desactivarlo, y comprobar que otro rol no puede realizar estas acciones.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** registra un usuario con nombre, correo, contraseña y rol, **Then** la cuenta queda creada y puede iniciar sesión.
2. **Given** un administrador autenticado, **When** consulta la lista de usuarios, **Then** ve las cuentas registradas sin que se muestre ninguna contraseña.
3. **Given** un administrador autenticado, **When** cambia el rol o los datos de un usuario, **Then** los cambios se guardan y aplican en su siguiente inicio de sesión.
4. **Given** un administrador autenticado, **When** desactiva un usuario, **Then** la cuenta conserva su registro pero ya no puede acceder.
5. **Given** un usuario que no es administrador, **When** intenta gestionar usuarios o roles, **Then** el sistema lo rechaza.
6. **Given** un administrador que registra un usuario con un correo ya existente, **When** envía el registro, **Then** el sistema lo rechaza indicando que el correo ya está en uso.
7. **Given** un administrador que registra un usuario con una contraseña de menos de 8 caracteres o sin al menos una letra y un número, **When** envía el registro, **Then** el sistema lo rechaza indicando la regla incumplida.

---

### User Story 3 - Registro y modificación de clientes (Priority: P3)

El administrador o el recepcionista registra nuevos clientes del gimnasio y modifica sus datos cuando cambian.

**Why this priority**: Los clientes son la entidad central sobre la que se construirán membresías, pagos y accesos en el siguiente sprint.

**Independent Test**: Como recepcionista, registrar un cliente con datos válidos, modificarlo, y comprobar que datos inválidos o duplicados son rechazados.

**Acceptance Scenarios**:

1. **Given** un administrador o recepcionista autenticado, **When** registra un cliente con datos válidos, **Then** el cliente queda almacenado y puede consultarse.
2. **Given** un administrador o recepcionista autenticado, **When** modifica los datos de un cliente existente, **Then** los cambios se guardan.
3. **Given** datos incompletos o con formato inválido, **When** se intenta registrar o modificar un cliente, **Then** el sistema los rechaza indicando qué campo debe corregirse y no guarda nada.
4. **Given** un correo ya registrado en otro cliente, **When** se intenta registrar o modificar un cliente con ese correo, **Then** el sistema lo rechaza.
5. **Given** un cliente sin nombre, apellido o teléfono, **When** se intenta registrarlo, **Then** el sistema lo rechaza indicando el campo faltante.
6. **Given** datos válidos sin correo ni dirección, **When** se registra el cliente, **Then** queda almacenado correctamente.
7. **Given** un administrador autenticado, **When** da de baja o reactiva a un cliente, **Then** su registro cambia a inactivo o activo y no se elimina; mientras esté inactivo su cuenta de acceso (si la tiene) no puede iniciar sesión, y al reactivarlo la recupera.
8. **Given** un entrenador o un cliente autenticado, **When** intenta registrar o modificar clientes, **Then** el sistema lo rechaza.
9. **Given** un recepcionista autenticado, **When** intenta dar de baja o reactivar a un cliente, **Then** el sistema lo rechaza.

---

### User Story 4 - Consulta de clientes por personal (Priority: P4)

El administrador, recepcionista y entrenador consultan la lista de clientes y la información individual de cada uno. El entrenador solo ve la información básica permitida para su rol.

**Why this priority**: Es consulta de datos ya registrados; aporta valor operativo diario pero requiere que existan clientes (P3).

**Independent Test**: Con clientes registrados, consultar como administrador, recepcionista y entrenador y comparar los datos visibles en cada rol.

**Acceptance Scenarios**:

1. **Given** un administrador o recepcionista autenticado, **When** consulta clientes, **Then** ve la información completa de sus datos personales.
2. **Given** un entrenador autenticado, **When** consulta clientes, **Then** ve únicamente nombre, apellido, estado y fecha de registro, sin teléfono, correo, dirección ni datos financieros o administrativos.
3. **Given** un cliente identificado por nombre o correo, **When** el personal lo busca, **Then** el sistema devuelve los clientes que coinciden.

---

### User Story 5 - Consulta de información propia por el cliente (Priority: P5)

Un cliente con cuenta en el sistema consulta sus propios datos registrados, sin poder ver los de ningún otro cliente.

**Why this priority**: Aporta transparencia al cliente, pero no es necesaria para la operación del personal.

**Independent Test**: Iniciar sesión como cliente, consultar su perfil, y verificar que no es posible consultar a otro cliente.

**Acceptance Scenarios**:

1. **Given** un cliente autenticado vinculado a su registro, **When** consulta su información, **Then** ve sus propios datos.
2. **Given** un cliente autenticado, **When** intenta consultar los datos de otro cliente, **Then** el sistema lo rechaza.
3. **Given** un cliente dado de baja, **When** intenta consultar su información (con credenciales o con una sesión abierta), **Then** el sistema le exige iniciar sesión y no se lo permite.

---

### Edge Cases

- Intentos repetidos de inicio de sesión fallido: tras 5 seguidos la cuenta se bloquea 15 minutos; el mensaje sigue siendo genérico y no revela si el correo existe. Un inicio de sesión exitoso reinicia el conteo.
- Sesión caducada o credencial de sesión manipulada: el sistema debe exigir iniciar sesión de nuevo.
- Un administrador intenta desactivar su propia cuenta o quitarse el rol de administrador, dejando el sistema sin administradores activos.
- Una cuenta con rol cliente sin registro de cliente vinculado.
- Correos con mayúsculas/minúsculas distintas o con espacios sobrantes tratados como duplicados.
- Clientes sin correo: varios pueden coexistir sin considerarse duplicados; un correo vacío o en blanco se trata como "sin correo".
- Un cliente sin correo no puede tener cuenta de acceso hasta que se le capture un correo; la cuenta usa el correo del cliente.
- Campos con texto excesivamente largo o con caracteres especiales o intentos de inyección: deben validarse y rechazarse o tratarse como texto inofensivo.
- Fallo de conexión con la base de datos: el usuario ve un mensaje genérico, sin detalles técnicos.
- Intento de eliminar un usuario o cliente: no existe eliminación; solo baja lógica.
- Un cliente dado de baja que tiene cuenta: no puede iniciar sesión ni usar una sesión abierta; al reactivarlo recupera el acceso sin recrear la cuenta. Las cuentas del personal no dependen del estado de ningún cliente.

## Requirements *(mandatory)*

### Functional Requirements

**Autenticación y sesión**

- **FR-001**: El sistema MUST permitir iniciar sesión con correo y contraseña a las cuentas de usuario activas.
- **FR-002**: El sistema MUST rechazar credenciales incorrectas con un mensaje genérico que no revele si el correo existe.
- **FR-003**: El sistema MUST rechazar el inicio de sesión de cuentas desactivadas.
- **FR-003b**: El sistema MUST rechazar el inicio de sesión, y cualquier sesión ya abierta, de una cuenta con rol cliente cuyo cliente esté dado de baja (inactivo), con el mismo mensaje genérico de credenciales incorrectas; al reactivar al cliente, su cuenta recupera el acceso.
- **FR-003a**: El sistema MUST bloquear temporalmente durante 15 minutos el inicio de sesión de una cuenta tras 5 intentos fallidos consecutivos, y MUST reiniciar el conteo tras un inicio de sesión exitoso.
- **FR-004**: El sistema MUST identificar el rol del usuario al iniciar sesión y mantener su sesión mediante una credencial de sesión con vencimiento.
- **FR-005**: El sistema MUST exigir sesión válida en todas las funciones protegidas.
- **FR-006**: El sistema MUST validar los permisos de cada rol en el servidor para toda solicitud, sin depender de lo que muestre la interfaz.
- **FR-007**: Las contraseñas MUST almacenarse protegidas con un hash seguro y NUNCA en texto plano ni devolverse en ninguna respuesta.

**Usuarios y roles**

- **FR-007a**: Toda contraseña nueva MUST tener al menos 8 caracteres, con al menos una letra y un número.
- **FR-008**: Solo el administrador MUST poder registrar, consultar, modificar, activar y desactivar usuarios, y asignar roles.
- **FR-009**: Los roles disponibles MUST ser únicamente: administrador, recepcionista, entrenador y cliente.
- **FR-010**: El correo de cada usuario MUST ser único en el sistema.
- **FR-011**: Una cuenta con rol cliente MUST estar vinculada a un registro de cliente existente que tenga correo; solo el administrador MUST poder crearla, de forma opcional, y usa el correo del cliente como correo de acceso.
- **FR-012**: El sistema MUST impedir que el sistema quede sin ningún administrador activo.
- **FR-013**: Los usuarios MUST NOT eliminarse físicamente; la baja es lógica mediante el estado de la cuenta.
- **FR-014**: No MUST existir auto-registro de usuarios ni recuperación de contraseña por correo en este sprint.

**Clientes**

- **FR-015**: El administrador y el recepcionista MUST poder registrar clientes con nombre, apellido y teléfono (obligatorios), y opcionalmente correo y dirección.
- **FR-016**: El administrador y el recepcionista MUST poder modificar los datos de un cliente.
- **FR-017**: El correo del cliente es opcional; cuando se captura, MUST ser único entre clientes. Varios clientes pueden no tener correo.
- **FR-018**: El sistema MUST validar los datos de cliente y de usuario en el servidor antes de almacenarlos, rechazando datos incompletos o inválidos con un mensaje que indique qué corregir.
- **FR-019**: El administrador, el recepcionista y el entrenador MUST poder consultar la lista de clientes y la información individual; el entrenador solo MUST ver nombre, apellido, estado y fecha de registro del cliente; MUST NOT ver teléfono, correo, dirección ni datos financieros o administrativos.
- **FR-020**: Un cliente MUST poder consultar únicamente su propia información y MUST NOT poder consultar la de otros clientes.
- **FR-021**: Los clientes MUST NOT eliminarse físicamente; la baja es lógica mediante el estado del registro, y se conserva la fecha de registro. Solo el administrador MUST poder dar de baja o reactivar a un cliente. Un cliente dado de baja no puede iniciar sesión (FR-003b).

**Preparación para siguientes sprints**

- **FR-022**: El sistema MUST dejar preparada la estructura de datos para membresías y pagos y para asociar información facial a un cliente, sin ofrecer todavía funcionalidad de membresías, pagos, reconocimiento facial, accesos, dashboard, reportes ni auditoría funcional.
- **FR-023**: Cuando se produzca un error, el sistema MUST mostrar mensajes claros al usuario sin revelar información interna del servidor.
- **FR-024**: El sistema MUST mostrar mensajes de éxito o error tras cada operación de registro, modificación o inicio de sesión.

**Datos de arranque**

- **FR-025**: Debe existir al menos una cuenta de administrador inicial para poder usar el sistema, creada sin exponer su contraseña en el repositorio.

### Key Entities

- **Usuario**: cuenta de acceso al sistema con nombre, correo único, contraseña protegida, rol y estado (activo/inactivo). Una cuenta con rol cliente se vincula a un Cliente.
- **Cliente**: persona del gimnasio con nombre, apellido y teléfono (obligatorios), correo (opcional, único entre clientes cuando se captura), dirección (opcional), fecha de registro y estado. Es la entidad a la que más adelante se asociarán membresías, pagos e información facial.
- **Rol**: administrador, recepcionista, entrenador o cliente; determina qué funciones y qué datos puede usar la cuenta.
- **Tipo de membresía, Membresía y Pago**: entidades cuya estructura queda lista en este sprint pero sin funcionalidad; se activan en el Sprint 2.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario con credenciales válidas inicia sesión y llega a su área de trabajo en menos de 10 segundos.
- **SC-002**: El 100% de los intentos de usar una función no permitida para el rol del usuario son rechazados, incluso cuando se hacen sin pasar por la interfaz.
- **SC-003**: El 100% de las solicitudes sin sesión válida a funciones protegidas son rechazadas.
- **SC-004**: El administrador puede dar de alta un usuario con su rol en menos de 2 minutos.
- **SC-005**: Un recepcionista puede registrar un cliente completo en menos de 2 minutos.
- **SC-006**: El 100% de los registros con datos inválidos o correos duplicados son rechazados sin guardarse, con un mensaje que indica qué corregir.
- **SC-007**: En ninguna respuesta del sistema aparece una contraseña ni información técnica interna.
- **SC-008**: Un cliente autenticado puede consultar sus propios datos y el 100% de sus intentos de ver datos de otros clientes son rechazados.
- **SC-009**: Al final del sprint se puede ejecutar de principio a fin el flujo completo: inicio de sesión, alta de un cliente por el recepcionista, consulta por el entrenador y consulta propia por el cliente, con los datos persistiendo tras reiniciar el sistema.
- **SC-010**: No existe ninguna credencial ni secreto dentro del repositorio.
- **SC-011**: El 100% de los intentos de un cliente dado de baja por iniciar sesión o por usar una sesión abierta son rechazados, y al reactivarlo recupera el acceso con la misma cuenta.

## Assumptions

- El proyecto es un sistema web con interfaz, servidor y base de datos separados; las decisiones de tecnología están fijadas en la constitución del proyecto (v1.1.1) y se detallarán en el plan, no en esta especificación.
- La base de datos `gymaccess` ya existe en MySQL local con sus 8 tablas (`usuarios`, `clientes`, `tipos_membresia`, `membresias`, `pagos`, `rostros`, `accesos`, `auditoria`); este sprint usa solo `usuarios` y `clientes` y no las vuelve a crear.
- El servidor se conecta con el usuario de base de datos `gymaccess_app`, que solo tiene permisos de consulta, inserción y actualización; por eso las bajas son lógicas y nunca se eliminan registros.
- Los roles son exactamente los cuatro definidos en el contexto maestro y no hay roles personalizables.
- El administrador inicial se crea mediante un mecanismo de arranque (semilla) cuya contraseña se proporciona fuera del repositorio.
- La expiración de la sesión es de 8 horas (jornada laboral), valor por defecto razonable que podrá ajustarse en la planificación.
- Los datos obligatorios de un cliente son nombre, apellido y teléfono; correo y dirección son opcionales, conforme a la tabla `clientes` ya existente.
- Cada cliente con cuenta propia tiene una sola cuenta de usuario vinculada, y las cuentas de cliente son opcionales y las crea el administrador.
- El acceso de una cuenta de cliente depende de dos estados a la vez: el de la cuenta y el del cliente. Si cualquiera está inactivo, no puede iniciar sesión.
- Los usuarios acceden desde un navegador moderno con conexión estable a la red local o de internet.
- Quedan fuera de este sprint: membresías, pagos, adeudos, reconocimiento facial (incluida su librería), accesos, dashboard, reportes, auditoría funcional, recuperación de contraseña, auto-registro, aplicación móvil y múltiples sucursales.
- Las decisiones pendientes del Sprint 2 (librería facial, almacenamiento biométrico, métodos de pago, políticas de membresías) no afectan a este sprint.
