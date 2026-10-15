# Feature Specification: Membresías, pagos, reconocimiento facial y control de acceso (Sprint 2)

**Feature Branch**: `003-membresias-pagos-acceso`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Usa la descripción de docs/sprint-2.md con el contexto de docs/project-context.md. La base de datos ya tiene las tablas tipos_membresia, membresias, pagos, rostros, accesos y auditoria: no crear tablas nuevas sin justificarlo. Agrega al menú lateral, con el Layout y los componentes ya creados, estas secciones según el rol: Dashboard (solo administrador), Tipos de membresía, Pagos, Adeudos, Accesos y Estación de acceso (pantalla completa para la entrada con la cámara). El Dashboard tiene filtro de periodo (hoy, semana, mes en curso, rango) y tarjetas de clientes activos, clientes con membresía vigente, vencida y por vencer, ingresos del periodo, accesos autorizados y rechazados, y lista de accesos recientes. Usa también el diseño reservado en specs/ para el Inicio del cliente, del administrador y del entrenador. Las pruebas usan gymaccess_test."

## Clarifications

### Session 2026-10-14

- Q: ¿Cuántos periodos futuros (renovaciones por adelantado) puede tener a la vez un cliente con membresía vigente? → A: Solo uno; mientras exista, no se puede renovar de nuevo.
- Q: Cuando se rechaza un acceso, ¿qué muestra la pantalla de la Estación de acceso? → A: El nombre del cliente identificado y el motivo exacto del rechazo.
- Q: Cuando un administrador desactiva el rostro de un cliente, ¿se borra su información facial o solo se marca inactiva? → A: Solo se marca inactiva y se conserva (protegida); un administrador puede reactivarla sin repetir la captura.
- Q: Si en la Estación de acceso varias personas seguidas no son reconocidas, ¿el sistema solo registra cada intento o hace algo más? → A: Registra cada intento y, tras 5 rechazos "Rostro no reconocido" seguidos, pausa la estación 30 segundos con un mensaje que invita a pedir ayuda en recepción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tipos de membresía (Priority: P1)

Como administrador, quiero registrar, consultar y modificar los tipos de membresía (nombre, descripción, duración en días y precio) para definir los planes que ofrece el gimnasio.

**Why this priority**: Sin planes no se puede asignar ninguna membresía; es la base de todo el sprint.

**Independent Test**: Entrar como administrador, abrir "Tipos de membresía", crear un plan, editarlo y desactivarlo; entrar como recepcionista y comprobar que solo puede consultarlos.

**Acceptance Scenarios**:

1. **Given** un administrador en "Tipos de membresía", **When** registra un plan con nombre, duración en días mayor a 0 y precio mayor o igual a 0, **Then** el plan aparece en la lista como activo y se muestra un aviso de éxito.
2. **Given** un plan existente, **When** el administrador cambia su nombre, descripción, duración o precio, **Then** los cambios se guardan y las membresías ya asignadas conservan el precio y la duración con que se asignaron.
3. **Given** un plan que ya tiene membresías, **When** el administrador lo desactiva (tras confirmar), **Then** deja de poder elegirse para nuevas asignaciones pero las membresías existentes no cambian y el plan no se borra.
4. **Given** un nombre de plan que ya existe, **When** el administrador intenta registrarlo, **Then** ve un error junto al campo indicando que el nombre ya está en uso.
5. **Given** un recepcionista, **When** abre "Tipos de membresía", **Then** puede consultar los planes activos pero no ve controles para crear, editar ni desactivar.
6. **Given** un entrenador o un cliente, **When** intenta abrir "Tipos de membresía", **Then** no ve la sección en el menú y, si escribe la dirección, ve "Sin permiso".

---

### User Story 2 - Asignar, renovar y administrar la membresía de un cliente (Priority: P1)

Como administrador o recepcionista, quiero asignar y renovar la membresía de un cliente registrado para registrar su periodo de acceso al gimnasio; y como administrador, quiero suspender, reactivar o cancelar una membresía.

**Why this priority**: La vigencia de la membresía es lo que decide si un cliente puede entrar; sin ella el control de acceso no tiene sentido.

**Independent Test**: Desde el detalle de un cliente sin membresía, asignarle un plan y ver que queda pendiente de pago; asignar otra con pago inmediato; renovarla; como administrador suspenderla, reactivarla y cancelarla, comprobando el estado mostrado en cada paso.

**Acceptance Scenarios**:

1. **Given** el detalle de un cliente activo sin membresía vigente ni pendiente de pago, **When** el personal elige un plan activo y una fecha de inicio (hoy por defecto), **Then** se crea la membresía con la fecha de fin calculada según la duración del plan y el precio acordado, y queda **pendiente de pago** (con un adeudo por el precio completo) hasta que se registre su pago; el detalle muestra plan, fechas, estado y adeudo.
2. **Given** el formulario de asignación, **When** el personal marca "Registrar el pago ahora" y elige el método de pago, **Then** se crean en una sola operación la membresía y su pago por el precio completo, y la membresía queda activa (vigente) sin adeudo.
3. **Given** un plan con precio $0, **When** se asigna, **Then** la membresía queda activa de inmediato, sin pago y sin adeudo.
4. **Given** un cliente que ya tiene una membresía en curso (la que cubre la fecha de hoy, vigente o pendiente de pago), **When** el personal intenta asignarle otra, **Then** el sistema lo impide: si es vigente, sugiere renovarla; si está pendiente de pago, pide registrar su pago (o que un administrador la cancele si se asignó por error).
5. **Given** una membresía vigente que vence en el futuro y que no tiene una renovación futura, **When** el personal la renueva, **Then** se crea un nuevo periodo que empieza el día siguiente a la fecha de fin actual (sin perder días), pendiente de pago hasta que se registre su pago (o activo de inmediato si se paga en la misma operación); el periodo actual sigue dando acceso hasta su fecha de fin y la membresía anterior conserva su historial.
6. **Given** una membresía vencida, **When** el personal la renueva, **Then** el nuevo periodo empieza en la fecha indicada (hoy por defecto) y queda pendiente de pago o activo según se registre o no el pago.
7. **Given** una membresía cuya fecha de fin es anterior a hoy, **When** se consulta, **Then** el sistema la muestra como vencida aunque nadie haya actualizado su estado manualmente.
8. **Given** una membresía pendiente de pago, **When** se consulta, **Then** se muestra como "Pendiente de pago" y no cuenta como vigente, aunque la fecha de hoy esté dentro de su periodo.
9. **Given** un administrador, **When** suspende una membresía (tras confirmar), **Then** su estado cambia a suspendida y el cliente deja de tener acceso; al reactivarla vuelve a su estado anterior (activa o pendiente de pago) con la misma fecha de fin.
10. **Given** un administrador, **When** cancela una membresía (tras confirmar), **Then** queda cancelada, sin posibilidad de reactivarla ni de registrarle pagos; los pagos ya registrados se conservan y para volver a tener acceso se debe asignar una nueva.
11. **Given** un recepcionista, **When** abre el detalle de un cliente, **Then** puede asignar y renovar, pero no ve controles para suspender, reactivar ni cancelar.
12. **Given** un cliente dado de baja (inactivo), **When** el personal intenta asignarle una membresía, **Then** el sistema lo impide indicando que primero debe reactivarse al cliente.
13. **Given** un cliente que ya tiene una renovación futura, o cuya membresía en curso está pendiente de pago, **When** el personal intenta renovarlo, **Then** el sistema lo impide: solo se permite una renovación futura a la vez (hasta que esa empiece), y una membresía pendiente de pago debe pagarse antes de renovarse; si la renovación futura está pendiente de pago, se ofrece registrar su pago.

---

### User Story 3 - Registrar el pago completo de una membresía (Priority: P1)

Como administrador o recepcionista, quiero registrar el pago completo de la membresía de un cliente para activarla y mantener el historial financiero.

**Why this priority**: Una membresía solo permite el acceso cuando su pago está registrado ("solo usuarios al corriente"), y el control financiero alimenta adeudos, dashboard e Inicio del cliente.

**Independent Test**: Con una membresía pendiente de pago, registrar su pago por el monto completo y verificar que pasa a vigente y sale de Adeudos; intentar pagar un monto distinto y pagar una membresía ya pagada.

**Acceptance Scenarios**:

1. **Given** una membresía pendiente de pago, **When** el personal registra un pago por el precio acordado completo con un método de pago (efectivo, tarjeta o transferencia), **Then** el pago queda asociado al cliente y a esa membresía con la fecha y hora actuales y el usuario que lo registró, la membresía pasa a estar activa (vigente mientras su periodo cubra la fecha de hoy) y el adeudo desaparece.
2. **Given** una membresía pendiente de pago de $450, **When** el personal intenta registrar un monto distinto (menor o mayor), **Then** el sistema lo rechaza con un mensaje claro: no hay pagos parciales y el pago debe ser por $450.
3. **Given** una membresía que ya tiene su pago registrado, **When** el personal intenta registrar otro, **Then** el sistema lo impide indicando que ya está pagada.
4. **Given** una membresía cancelada, **When** el personal intenta registrarle un pago, **Then** el sistema lo impide.
5. **Given** el historial de pagos, **When** cualquier usuario lo consulta, **Then** no existe ninguna opción para eliminar o editar pagos.
6. **Given** un método de pago no permitido, **When** el personal intenta registrar el pago, **Then** ve un error junto al campo correspondiente.

---

### User Story 4 - Registrar el rostro de un cliente (Priority: P1)

Como administrador o recepcionista, quiero registrar la información facial de un cliente ya registrado para que pueda identificarse al ingresar.

**Why this priority**: Sin rostro registrado un cliente no puede usar la estación de acceso.

**Independent Test**: Desde el detalle de un cliente, registrar su rostro con la cámara, ver que figura como "Registrado", reemplazarlo, desactivarlo y reactivarlo; comprobar que ninguna respuesta del sistema contiene datos faciales.

**Acceptance Scenarios**:

1. **Given** el detalle de un cliente activo sin rostro, **When** el personal abre "Registrar rostro", confirma que el cliente dio su consentimiento y completa la captura con la cámara, **Then** el sistema guarda solo la información facial necesaria para identificarlo (no la foto) y el detalle muestra "Rostro registrado" con la fecha.
2. **Given** un cliente con rostro registrado, **When** el personal vuelve a registrarlo, **Then** el registro anterior queda inactivo y solo el nuevo se usa para identificar.
3. **Given** un cliente con rostro registrado, **When** un administrador lo desactiva (tras confirmar), **Then** el cliente deja de poder identificarse con el rostro y el registro se conserva como inactivo, con su información facial protegida (no se borra).
4. **Given** un rostro inactivo, **When** un administrador lo reactiva (tras confirmar), **Then** el cliente vuelve a poder identificarse sin repetir la captura; si el cliente tenía otro rostro activo, este pasa a inactivo, porque solo puede haber uno activo.
5. **Given** la captura, **When** no se detecta un rostro, hay más de uno o la imagen es de mala calidad (poca luz, borrosa), **Then** el sistema pide repetir la captura con una indicación clara y no guarda nada.
6. **Given** que la cámara no está disponible o el permiso fue denegado, **When** el personal intenta registrar el rostro, **Then** ve un mensaje claro de cómo habilitarla y puede reintentar.
7. **Given** un cliente inactivo o inexistente, **When** se intenta registrar su rostro, **Then** el sistema lo impide.
8. **Given** cualquier pantalla o respuesta del sistema, **When** se revisa, **Then** nunca contiene la información facial ni imágenes del rostro; solo se indica si el cliente tiene rostro registrado o no.

---

### User Story 5 - Entrar al gimnasio con el rostro: la Estación de acceso (Priority: P1)

Como cliente registrado, quiero identificarme con mi rostro en la entrada para que el sistema valide mi membresía y me permita pasar; y como personal, quiero una pantalla completa dedicada para la entrada.

**Why this priority**: Es el flujo principal del proyecto y el criterio de aceptación del MVP.

**Independent Test**: Abrir la Estación de acceso con una cuenta de recepcionista; presentar el rostro de un cliente con membresía vigente (autorizado) y de otros con membresía vencida, suspendida, cancelada, sin membresía, dado de baja y no registrado (rechazados); verificar el resultado en pantalla y el registro de cada intento.

**Acceptance Scenarios**:

1. **Given** un cliente con rostro registrado y membresía vigente, **When** se presenta ante la cámara de la estación, **Then** la pantalla muestra en grande y en verde "Acceso autorizado" con su nombre, el plan y los días restantes, y se registra un acceso autorizado de tipo entrada.
2. **Given** un cliente identificado con membresía vencida, suspendida o cancelada, **When** se presenta ante la cámara, **Then** la pantalla muestra en rojo "Acceso rechazado" con el nombre del cliente y el motivo exacto ("Membresía vencida", "Membresía suspendida" o "Membresía cancelada"), y se registra un acceso rechazado con ese motivo y el cliente identificado.
3. **Given** un cliente identificado que no tiene ninguna membresía, **When** se presenta, **Then** la pantalla muestra su nombre y el motivo "Sin membresía", y se registra.
4. **Given** un cliente dado de baja, **When** se presenta, **Then** la pantalla muestra su nombre y el motivo "Cliente dado de baja", y se registra.
5. **Given** una persona sin rostro registrado o con un rostro que no coincide con ninguno, **When** se presenta, **Then** se rechaza con el motivo "Rostro no reconocido", se registra el intento sin cliente asociado y la pantalla muestra un mensaje amable que invita a pedir ayuda en recepción.
6. **Given** que la identificación termina, **When** pasan 5 segundos, **Then** la estación vuelve sola al estado de espera para la siguiente persona.
7. **Given** una misma persona frente a la cámara, **When** permanece ahí, **Then** el sistema no genera un intento nuevo en cada instante: registra un solo intento y espera al menos 10 segundos antes de aceptar otro de la misma persona.
8. **Given** que no hay ninguna persona frente a la cámara, **When** la estación está en espera, **Then** no se registra nada y no se guardan imágenes.
9. **Given** la estación abierta, **When** el personal pulsa "Salir", **Then** la cámara se apaga y regresa al sistema; si la sesión vence, la estación pide iniciar sesión de nuevo sin registrar accesos.
10. **Given** un cliente al corriente (membresía vigente con su pago completo registrado), **When** se presenta, **Then** se autoriza el acceso sin ninguna otra condición.
11. **Given** un rol sin permiso (entrenador o cliente), **When** intenta abrir la estación, **Then** no ve la sección y, si escribe la dirección, ve "Sin permiso".
12. **Given** un cliente identificado con una membresía cuyo periodo cubre hoy pero que no tiene su pago registrado (adeudo), **When** se presenta, **Then** NO se autoriza el acceso: la pantalla muestra en rojo "Acceso rechazado" con su nombre y el motivo "Pago pendiente" junto con una invitación amable a pasar por recepción, y se registra un acceso rechazado con ese motivo y el cliente identificado.
13. **Given** que la estación acumula 5 rechazos "Rostro no reconocido" seguidos, **When** llega el quinto, **Then** se registra normalmente y la estación se pausa 30 segundos mostrando un mensaje que invita a pedir ayuda en recepción; durante la pausa no se procesa ni se registra ningún intento, y al terminar vuelve al estado de espera con el conteo en cero. El conteo también vuelve a cero cuando se identifica a un cliente (aunque su acceso sea rechazado por otro motivo).

---

### User Story 6 - Consultar los accesos (Priority: P2)

Como administrador, recepcionista o entrenador, quiero consultar los intentos de acceso para conocer las entradas autorizadas y los rechazos.

**Why this priority**: Da visibilidad a lo ocurrido en la entrada, pero el control de acceso funciona sin esta pantalla.

**Independent Test**: Generar accesos autorizados y rechazados, abrir "Accesos" con cada rol y comprobar listado, filtros, paginación y qué datos ve cada rol.

**Acceptance Scenarios**:

1. **Given** accesos registrados, **When** el personal abre "Accesos", **Then** ve una tabla paginada, del más reciente al más antiguo, con fecha y hora, cliente (o "No identificado"), tipo, resultado con insignia (color y texto) y motivo cuando fue rechazado.
2. **Given** la lista, **When** filtra por fecha o rango, por resultado (autorizado o rechazado) o busca por nombre de cliente, **Then** la lista muestra solo lo que coincide, con estado vacío claro si no hay resultados.
3. **Given** un entrenador, **When** abre "Accesos", **Then** ve el listado con la información básica del cliente (nombre) y sin datos de contacto ni financieros.
4. **Given** un cliente, **When** consulta su Inicio, **Then** ve solo sus propias visitas y nunca las de otros.
5. **Given** cualquier usuario, **When** revisa el listado, **Then** no existe ninguna opción para editar ni eliminar accesos.

---

### User Story 7 - Consultar pagos y adeudos (Priority: P2)

Como administrador o recepcionista, quiero consultar el historial de pagos y la lista de adeudos para llevar el control de lo cobrado y de lo pendiente.

**Why this priority**: Completa el control financiero, pero el registro de pagos (historia 3) ya aporta valor por sí mismo.

**Independent Test**: Con membresías pagadas y pendientes de pago, abrir "Pagos" y "Adeudos" y verificar cifras, filtros y paginación.

**Acceptance Scenarios**:

1. **Given** pagos registrados, **When** el personal abre "Pagos", **Then** ve una tabla paginada del más reciente al más antiguo con fecha, cliente, membresía (plan), monto, método y quién lo registró, y un botón principal "Registrar pago".
2. **Given** la lista de pagos, **When** filtra por fecha o rango, por método o busca por cliente, **Then** la lista y el total mostrado reflejan solo lo filtrado.
3. **Given** membresías pendientes de pago, **When** el personal abre "Adeudos", **Then** ve por cliente y membresía el plan, el adeudo (precio completo), la fecha de inicio y de fin y el estado, ordenados con la fecha de inicio más antigua primero, y puede ir directamente a registrar el pago.
4. **Given** una membresía cuyo pago ya se registró, **When** se abre "Adeudos", **Then** ya no aparece en la lista.
5. **Given** un cliente o un entrenador, **When** intenta abrir "Pagos" o "Adeudos", **Then** no ve las secciones y, si escribe la dirección, ve "Sin permiso".
6. **Given** un cliente, **When** consulta su Inicio, **Then** ve solo sus propios pagos y su adeudo.

---

### User Story 8 - Dashboard del administrador (Priority: P2)

Como administrador, quiero un tablero con la situación general del gimnasio y un filtro de periodo para tomar decisiones.

**Why this priority**: Es un objetivo específico del proyecto (dashboard administrativo) y da valor inmediato, pero depende de que ya existan datos de membresías, pagos y accesos.

**Independent Test**: Con datos de prueba conocidos, abrir el Dashboard, cambiar entre hoy, semana, mes y un rango, y comparar cada cifra con las listas de origen.

**Acceptance Scenarios**:

1. **Given** el administrador en "Dashboard", **When** se carga, **Then** el periodo predeterminado es "Hoy" y ve tarjetas de: clientes activos, clientes con membresía vigente, con membresía vencida y con membresía por vencer, ingresos del periodo, accesos autorizados del periodo, accesos rechazados del periodo, y una lista de accesos recientes.
2. **Given** el filtro de periodo, **When** elige "Hoy", "Semana" (de lunes a hoy), "Mes en curso" o "Rango" con fecha de inicio y fin, **Then** los ingresos, los accesos autorizados y rechazados y la lista de accesos se recalculan para ese periodo, y el periodo elegido se ve indicado con las fechas exactas.
3. **Given** un rango inválido (inicio posterior al fin, fechas futuras o mayor a 366 días), **When** intenta aplicarlo, **Then** ve un error claro y no se actualizan las cifras.
4. **Given** las tarjetas de clientes, **When** cambia el periodo, **Then** las tarjetas de clientes activos y de situación de membresías no cambian, porque describen el estado actual (a la fecha de hoy), y así se indica en la pantalla.
5. **Given** un periodo sin datos, **When** se muestra, **Then** las cifras salen en 0 y la lista de accesos muestra un estado vacío claro.
6. **Given** un recepcionista, entrenador o cliente, **When** intenta abrir el Dashboard, **Then** no ve la sección y, si escribe la dirección, ve "Sin permiso"; el servidor también rechaza la consulta de estas cifras.
7. **Given** una cifra del dashboard, **When** se compara con la lista de origen (clientes, membresías, pagos o accesos), **Then** coinciden.

---

### User Story 9 - Inicio de cada rol con la información del Sprint 2 (Priority: P2)

Como cliente, administrador, recepcionista o entrenador, quiero ver en mi Inicio la información de membresías, pagos y accesos que corresponde a mi rol, usando los espacios que quedaron reservados en el rediseño de interfaz (`specs/002-interfaz-menu-lateral/spec.md`).

**Why this priority**: Aprovecha el trabajo ya reservado y hace útil el Inicio de cada rol, pero no bloquea el flujo principal.

**Independent Test**: Entrar con cada rol y comprobar que aparecen exactamente los elementos de su rol y ninguno que no le corresponda.

**Acceptance Scenarios**:

1. **Given** un cliente en su Inicio, **When** se carga, **Then** ve, debajo de su tarjeta de información, cuatro tarjetas: "Mi membresía" (plan, estado, fecha de vencimiento y días restantes con barra de progreso: verde, amarilla si faltan 5 días o menos y roja si está vencida, siempre con texto; si está pendiente de pago se muestra "Pendiente de pago" en amarillo con el monto que debe y la invitación a pasar por recepción, y sin barra de días), "Acceso facial" (rostro registrado: sí o no, sin ningún dato biométrico), "Mis últimas visitas" (últimos accesos autorizados y rechazados con motivo) y "Mis pagos" (últimos pagos y adeudo, o "Sin adeudo"). El diseño detallado es el del Anexo de la especificación 002.
2. **Given** un cliente sin membresía, sin rostro, sin visitas o sin pagos, **When** ve su Inicio, **Then** cada tarjeta muestra un estado vacío claro (por ejemplo, "Aún no tienes una membresía").
3. **Given** un administrador o recepcionista en su Inicio, **When** se carga, **Then** además de lo que ya veía, aparecen los indicadores "Accesos de hoy" y "Membresías por vencer" que estaban reservados.
4. **Given** un entrenador en su Inicio, **When** se carga, **Then** aparece el indicador "Clientes que entraron hoy" y una lista con los últimos clientes que entraron (avatar de iniciales, nombre completo y hora), sin datos de contacto ni financieros; "Mis clientes asignados" y rutinas siguen fuera de este sprint.
5. **Given** cualquier rol, **When** se carga su Inicio, **Then** no recibe información que su rol no puede ver (el cliente solo la suya; el entrenador nada financiero ni de contacto).

---

### User Story 10 - Menú lateral con las secciones del Sprint 2 (Priority: P2)

Como usuario del personal, quiero ver en el menú lateral las secciones nuevas que mi rol puede usar, con la misma estructura y estilo del sistema.

**Why this priority**: Es la puerta de entrada a las pantallas nuevas y reutiliza el Layout y la configuración de menú ya creados.

**Independent Test**: Entrar con cada rol y comparar el menú con la tabla del Anexo.

**Acceptance Scenarios**:

1. **Given** un administrador, **When** abre el sistema, **Then** el menú muestra además de las secciones actuales: Dashboard, Tipos de membresía, Pagos, Adeudos, Accesos y Estación de acceso.
2. **Given** un recepcionista, **When** abre el sistema, **Then** el menú muestra Tipos de membresía (solo consulta), Pagos, Adeudos, Accesos y Estación de acceso, pero no Dashboard.
3. **Given** un entrenador, **When** abre el sistema, **Then** el menú muestra solo Accesos como sección nueva.
4. **Given** un cliente, **When** abre el sistema, **Then** el menú no cambia (Inicio y Mi información).
5. **Given** cualquier sección nueva, **When** el usuario está en ella, **Then** aparece resaltada en el menú y el encabezado muestra su título.
6. **Given** la "Estación de acceso", **When** el personal la abre desde el menú, **Then** se muestra a pantalla completa (sin menú lateral ni encabezado) con un botón claro para salir.

---

### User Story 11 - Auditoría de acciones importantes (Priority: P3)

Como administrador, quiero que el sistema deje constancia de las acciones importantes para poder revisarlas después.

**Why this priority**: El MVP incluye auditoría, pero la pantalla de consulta no forma parte de este sprint; aquí solo se registra.

**Independent Test**: Realizar cada acción listada y comprobar, directamente en los registros de la base de pruebas, que existe un evento con usuario, acción, módulo, fecha, resultado y descripción.

**Acceptance Scenarios**:

1. **Given** una de estas acciones: crear o modificar o desactivar un tipo de membresía; asignar, renovar, suspender, reactivar o cancelar una membresía; registrar un pago; registrar, reemplazar, desactivar o reactivar un rostro, **When** se completa, **Then** se guarda un evento de auditoría con el usuario que la hizo, la acción, el módulo, la fecha y hora, el resultado y una descripción breve sin datos sensibles.
2. **Given** una de esas acciones que falla (por ejemplo, por validación o permisos), **When** ocurre, **Then** se registra con resultado de error cuando se llegó a intentar la operación.
3. **Given** un evento de auditoría, **When** se revisa su contenido, **Then** no incluye información facial, contraseñas ni datos de pago sensibles.
4. **Given** los registros de auditoría, **When** cualquier usuario intenta modificarlos o eliminarlos, **Then** no existe ninguna forma de hacerlo desde el sistema.

---

### Edge Cases

- ¿Qué pasa si dos personas del personal intentan asignar una membresía al mismo cliente a la vez? Solo se crea una; la segunda recibe un aviso de que el cliente ya tiene una vigente.
- ¿Qué pasa si dos personas del personal intentan registrar el pago de la misma membresía a la vez? Solo se registra uno; el otro recibe un aviso de que la membresía ya está pagada.
- ¿Qué pasa si el pago se registra después de la fecha de inicio? Las fechas de la membresía no se recorren: el periodo sigue siendo el asignado y los días sin pago no se recuperan (por eso la asignación ofrece registrar el pago en el mismo momento).
- ¿Qué pasa si una membresía se asignó por error y aún no tiene pago? Un administrador puede cancelarla; mientras tanto no da acceso y bloquea una nueva asignación.
- ¿Qué pasa con una membresía que vence hoy? Sigue siendo válida durante todo el día de su fecha de fin y aparece como "vence hoy" (0 días restantes).
- ¿Qué pasa si el reloj del servidor cambia de día mientras la estación está abierta? Cada intento se evalúa con la fecha del momento en que ocurre.
- ¿Qué pasa si dos clientes se parecen y el sistema duda? Si no hay una coincidencia clara con un solo cliente, se rechaza como "Rostro no reconocido" y nunca se autoriza por parecido dudoso.
- ¿Qué pasa si hay varios rostros a la vez frente a la cámara? La estación no registra ningún intento y pide pasar de uno en uno.
- ¿Qué pasa si alguien prueba rostros repetidamente? Tras 5 rechazos "Rostro no reconocido" seguidos, la estación se pausa 30 segundos y pide ayuda en recepción; todos los intentos previos quedan registrados.
- ¿Qué pasa si hay poca luz o la cámara se desconecta durante el uso? La estación muestra un mensaje claro de que no puede leer el rostro y permite reintentar, sin registrar intentos falsos.
- ¿Qué pasa si el navegador no concede el permiso de cámara? Se explica cómo habilitarlo y el sistema no registra nada.
- ¿Qué pasa si se presenta una fotografía de un cliente en lugar de su rostro real? Esta versión no incluye detección de vida; el riesgo se documenta como limitación conocida.
- ¿Qué pasa con el rostro de un cliente que se da de baja? El rostro se conserva inactivo y el cliente se rechaza con "Cliente dado de baja"; si se reactiva al cliente, vuelve a poder identificarse.
- ¿Qué pasa si el plan de una membresía se desactiva? Las membresías existentes siguen su curso; solo se impide usarlo en asignaciones nuevas.
- ¿Qué pasa si se cambia el precio de un plan con membresías pendientes de pago? El adeudo de esas membresías no cambia; el nuevo precio rige solo para asignaciones futuras.
- ¿Qué pasa si una lista (pagos, adeudos o accesos) tiene miles de registros? Se pagina y se puede filtrar; el rendimiento no se degrada de forma perceptible.
- ¿Qué pasa si falla la carga del Dashboard o de las tarjetas del Inicio? Se muestra un aviso de error claro y el resto de la pantalla sigue disponible.
- ¿Qué pasa si la sesión del personal vence con la estación abierta? La estación deja de aceptar intentos y pide iniciar sesión.

## Requirements *(mandatory)*

### Functional Requirements

**Menú, permisos y navegación**

- **FR-001**: El menú lateral DEBE incluir las secciones Dashboard, Tipos de membresía, Pagos, Adeudos, Accesos y Estación de acceso, visibles solo para los roles indicados en el Anexo, usando la configuración de menú, el Layout y los componentes existentes; agregar cada sección DEBE requerir únicamente añadir su entrada a la configuración del menú y su pantalla.
- **FR-002**: Cada sección nueva DEBE agruparse en el menú con un encabezado de bloque claro (las secciones de membresías y pagos en su propio bloque) y mostrar el estado activo y el título en el encabezado como el resto de las pantallas.
- **FR-003**: Los permisos de cada pantalla y de cada operación DEBEN validarse en el servidor según el rol; ocultar una opción del menú NO DEBE considerarse suficiente. Un rol sin permiso DEBE recibir un rechazo del servidor y ver la página "Sin permiso" en la interfaz.
- **FR-004**: La "Estación de acceso" DEBE abrirse a pantalla completa, sin menú lateral ni encabezado, con un botón visible para salir, y exigir una sesión del personal autorizado (administrador o recepcionista).

**Tipos de membresía**

- **FR-005**: El sistema DEBE permitir al administrador registrar, consultar, modificar y desactivar (baja lógica) tipos de membresía con nombre único, descripción opcional, duración en días mayor a 0 y precio mayor o igual a 0.
- **FR-006**: El recepcionista DEBE poder consultar los tipos de membresía activos para asignarlos, sin poder modificarlos.
- **FR-007**: Los cambios de precio o duración de un tipo NO DEBEN alterar las membresías ya asignadas: cada membresía conserva el precio y la duración acordados al asignarla.
- **FR-008**: Un tipo de membresía desactivado NO DEBE poder usarse en asignaciones nuevas y NO DEBE eliminarse.

**Membresías**

- **FR-009**: El personal (administrador y recepcionista) DEBE poder asignar una membresía a un cliente activo y registrado, eligiendo un tipo activo y una fecha de inicio (hoy por defecto); el sistema DEBE calcular la fecha de fin a partir de la duración del tipo y guardar fecha de inicio, fecha de fin y el precio acordado. La membresía DEBE quedar pendiente de pago, salvo que se registre su pago en la misma operación o que su precio sea $0, casos en que queda activa de inmediato.
- **FR-010**: Un cliente NO DEBE tener más de una membresía en curso (la que cubre la fecha de hoy, vigente o pendiente de pago) ni más de una renovación futura. Si ya tiene una membresía en curso, el sistema DEBE impedir una nueva asignación y ofrecer renovar la vigente o registrar el pago de la pendiente; si ya tiene una renovación futura, DEBE impedir renovar de nuevo hasta que esa empiece.
- **FR-011**: La renovación DEBE crear un nuevo periodo con las mismas reglas de pago que una asignación: si la membresía vigente aún no vence, empieza el día siguiente a su fecha de fin; si ya venció, empieza en la fecha indicada (hoy por defecto). Los periodos anteriores DEBEN conservarse como historial y el periodo vigente sigue dando acceso hasta su fecha de fin. NO se puede renovar una membresía en curso pendiente de pago ni cuando ya existe una renovación futura (FR-010).
- **FR-012**: El sistema DEBE determinar el estado real de una membresía a partir de su estado guardado, sus fechas y su pago: pendiente de pago (sin pago registrado), activa, vencida (fecha de fin anterior a hoy, sin depender de procesos manuales), suspendida o cancelada. Una membresía solo es **vigente** cuando está activa, su pago completo está registrado y la fecha de hoy está dentro de su periodo.
- **FR-013**: Una membresía es "por vencer" cuando está vigente y le quedan 5 días o menos (incluido el día de su fecha de fin); esta misma definición DEBE usarse en el Dashboard, el Inicio y las tarjetas de color.
- **FR-014**: Solo el administrador DEBE poder suspender, reactivar y cancelar una membresía, con confirmación previa. Una membresía cancelada NO DEBE poder reactivarse ni recibir pagos; reactivar una suspendida la devuelve a su estado anterior (activa o pendiente de pago) con la misma fecha de fin. Los pagos de una membresía cancelada se conservan.
- **FR-015**: El detalle de cada cliente DEBE mostrar su membresía actual (plan, fechas, estado, días restantes y adeudo si está pendiente de pago) y el historial de sus membresías, con las acciones de asignar, renovar, registrar el pago y (solo administrador) suspender, reactivar y cancelar.

**Pagos y adeudos**

- **FR-016**: El personal (administrador y recepcionista) DEBE poder registrar el pago de una membresía pendiente de pago indicando el método (efectivo, tarjeta o transferencia); el pago DEBE quedar asociado al cliente y a esa membresía, con fecha y hora actuales y el usuario que lo registró, y la membresía DEBE pasar a activa. Las membresías de precio $0 no requieren pago.
- **FR-017**: NO existen pagos parciales: cada membresía se paga una sola vez y por su precio acordado completo. El sistema DEBE rechazar cualquier monto distinto al precio acordado (indicando el monto correcto) y cualquier segundo pago de una membresía ya pagada.
- **FR-018**: El adeudo de una membresía DEBE ser su precio acordado completo mientras no tenga pago registrado, y cero en cuanto se registre; una membresía sin adeudo NO DEBE aparecer en Adeudos.
- **FR-019**: Los pagos NO DEBEN poder editarse ni eliminarse desde el sistema; el historial financiero se conserva.
- **FR-020**: La pantalla "Pagos" DEBE listar el historial paginado (más reciente primero) con filtros por fecha o rango, método y búsqueda por cliente, y un botón principal "Registrar pago". La pantalla "Adeudos" DEBE listar las membresías pendientes de pago con la fecha de inicio más antigua primero, con acceso directo a registrar su pago.
- **FR-021**: Los pagos y adeudos DEBEN ser visibles solo para administrador y recepcionista; el entrenador NO DEBE acceder a información financiera y el cliente solo a la suya.

**Reconocimiento facial: registro**

- **FR-022**: El personal DEBE poder registrar el rostro de un cliente activo desde su detalle, usando la cámara, solo tras confirmar que el cliente dio su consentimiento. Solo se registra para clientes existentes.
- **FR-023**: El sistema DEBE guardar únicamente la información facial necesaria para identificar (no fotografías), protegida de forma que no pueda leerse directamente, y NO DEBE devolverla en ninguna respuesta ni mostrarla en ninguna pantalla; solo se informa si el cliente tiene rostro registrado y desde cuándo.
- **FR-024**: Un cliente DEBE tener a lo más un rostro activo: registrar uno nuevo desactiva el anterior. Solo el administrador DEBE poder desactivar y reactivar un rostro, con confirmación; desactivar NO borra la información facial, que se conserva protegida en un registro inactivo, y reactivar un rostro inactivo desactiva el que estuviera activo. Los registros no se eliminan.
- **FR-025**: Si la captura no tiene exactamente un rostro claro y suficiente calidad, el sistema DEBE pedir repetirla con una indicación comprensible y no guardar nada.
- **FR-026**: Si la cámara no está disponible o no tiene permiso, el sistema DEBE explicarlo con claridad y permitir reintentar.

**Estación de acceso y control de acceso**

- **FR-027**: La estación DEBE capturar con la cámara el rostro de la persona que llega, identificar al cliente registrado que coincide y, solo después, validar su membresía.
- **FR-028**: Se DEBE autorizar el acceso únicamente cuando existe una coincidencia facial clara con un solo cliente activo y ese cliente está al corriente: tiene una membresía vigente (activa, con su pago completo registrado y la fecha actual dentro de su periodo). Una coincidencia facial por sí sola NO DEBE bastar.
- **FR-029**: Se DEBE rechazar el acceso, con el motivo correspondiente, cuando: el rostro no se reconoce o la coincidencia no es clara ("Rostro no reconocido"); el cliente está dado de baja ("Cliente dado de baja"); no tiene membresía ("Sin membresía"); o su membresía está vencida, suspendida o cancelada ("Membresía vencida", "Membresía suspendida" o "Membresía cancelada"); o su membresía cubre hoy pero no tiene el pago registrado ("Pago pendiente"). El motivo corresponde a la membresía que cubre la fecha de hoy; si ninguna la cubre y la última ya terminó, es "Membresía vencida"; si el cliente no tiene ninguna, "Sin membresía".
- **FR-030**: Todo intento de acceso (autorizado o rechazado) DEBE registrarse con fecha, hora, tipo (entrada), resultado y, si fue rechazado, su motivo; si el cliente no se identificó, el intento se registra sin cliente. Los registros de acceso NO DEBEN poder editarse ni eliminarse.
- **FR-031**: La estación DEBE mostrar el resultado a pantalla completa y de forma inequívoca: verde y texto para autorizado, con nombre, plan y días restantes; rojo y texto para rechazado, con el nombre del cliente identificado (si lo hay) y el motivo exacto del rechazo; y volver sola al estado de espera a los 5 segundos. Cuando el rostro no se reconoce no se muestra ningún nombre.
- **FR-032**: La estación NO DEBE registrar un intento nuevo en cada instante: DEBE registrar un solo intento por persona presente y respetar una espera de al menos 10 segundos antes de aceptar otro de la misma persona. Sin una persona frente a la cámara NO DEBE registrar nada ni conservar imágenes.
- **FR-033**: Un cliente con adeudo (membresía sin pago registrado) NO DEBE poder entrar: el acceso solo se autoriza a clientes al corriente, aunque las fechas de su membresía cubran la fecha de hoy.
- **FR-034**: El reconocimiento facial se usa EXCLUSIVAMENTE para identificar a clientes registrados en el punto de acceso: NO DEBE usarse para vigilancia, seguimiento, ni identificar a personas no registradas con otros fines.
- **FR-053**: Como medida contra intentos repetidos, la estación DEBE contar los rechazos "Rostro no reconocido" consecutivos; al llegar a 5 DEBE pausarse 30 segundos mostrando un mensaje que invita a pedir ayuda en recepción, sin procesar ni registrar intentos durante la pausa. El conteo vuelve a cero al identificar a un cliente o al terminar la pausa. Cada intento previo a la pausa se registra normalmente.

**Consulta de accesos**

- **FR-035**: La pantalla "Accesos" DEBE listar los intentos paginados (más reciente primero) con fecha y hora, cliente (o "No identificado"), tipo, resultado con insignia de color y texto, y motivo del rechazo; con filtros por fecha o rango, resultado y búsqueda por nombre.
- **FR-036**: Administrador y recepcionista DEBEN ver el detalle completo del cliente en los accesos; el entrenador DEBE ver solo información básica (nombre, fecha, hora y resultado), sin datos de contacto ni financieros; el cliente DEBE ver únicamente sus propios accesos en su Inicio.

**Dashboard**

- **FR-037**: El Dashboard (solo administrador) DEBE incluir un filtro de periodo con las opciones Hoy (predeterminado), Semana (de lunes a hoy), Mes en curso y Rango (fecha de inicio y de fin válidas, sin fechas futuras ni más de 366 días), e indicar siempre las fechas del periodo aplicado.
- **FR-038**: El Dashboard DEBE mostrar, como estado actual a la fecha de hoy y sin depender del periodo: clientes activos, clientes con membresía vigente, clientes con membresía vencida y clientes con membresía por vencer.
- **FR-039**: El Dashboard DEBE mostrar, para el periodo elegido: ingresos (suma de los pagos registrados), accesos autorizados, accesos rechazados y una lista de accesos recientes del periodo.
- **FR-040**: Un cliente cuenta en una sola categoría de situación de membresía: vigente (membresía vigente con su pago registrado), vencida (su última membresía pagada terminó y no tiene otra vigente) o sin membresía; "por vencer" es un subconjunto de los vigentes (FR-013). Las membresías pendientes de pago no cuentan como vigentes y se consultan en Adeudos.
- **FR-041**: Cada cifra del Dashboard DEBE coincidir con la información de las listas de origen, y el servidor DEBE rechazar su consulta a cualquier rol que no sea administrador.

**Inicio de cada rol**

- **FR-042**: El Inicio del cliente DEBE mostrar las tarjetas "Mi membresía", "Acceso facial", "Mis últimas visitas" y "Mis pagos" según el diseño reservado en el Anexo de `specs/002-interfaz-menu-lateral/spec.md`, con estados vacíos, solo con datos propios y sin ningún dato biométrico; "Mi membresía" DEBE mostrar "Pendiente de pago" (con el monto que debe) cuando corresponda.
- **FR-043**: El Inicio del administrador y del recepcionista DEBE activar los indicadores "Accesos de hoy" y "Membresías por vencer" reservados en el rediseño.
- **FR-044**: El Inicio del entrenador DEBE activar el indicador y la lista "Clientes que entraron hoy" reservados en el rediseño, con la proyección básica (sin teléfono, correo, dirección ni información financiera); "Mis clientes asignados" y rutinas siguen fuera de alcance.

**Auditoría**

- **FR-045**: El sistema DEBE registrar eventos de auditoría (usuario, acción, módulo, fecha y hora, resultado y descripción breve) para: crear, modificar y desactivar tipos de membresía; asignar, renovar, suspender, reactivar y cancelar membresías; registrar pagos; y registrar, reemplazar, desactivar y reactivar rostros.
- **FR-046**: Los eventos de auditoría NO DEBEN incluir información facial, contraseñas ni datos sensibles, y NO DEBEN poder modificarse ni eliminarse desde el sistema. La pantalla de consulta de auditoría queda fuera de este sprint.

**Interfaz, seguridad y datos**

- **FR-047**: Todas las pantallas nuevas DEBEN usar el sistema visual y los componentes comunes existentes (tablas con estado vacío y paginación, formularios con error por campo y estado de carga, insignias con color y texto, avisos de éxito o error y confirmación en bajas y cambios de estado), con textos en español y adaptables a pantallas de 360 a 1920 px.
- **FR-048**: Los datos DEBEN guardarse en las tablas existentes (`tipos_membresia`, `membresias`, `pagos`, `rostros`, `accesos`, `auditoria`); NO DEBEN crearse tablas nuevas. Si hiciera falta un cambio de estructura (por ejemplo, conservar el precio acordado por membresía), DEBE justificarse y hacerse con un script de migración numerado nuevo, sin tocar la base real con scripts destructivos.
- **FR-049**: Las bajas DEBEN ser lógicas (cambio de estado); los registros de pagos, accesos y auditoría NO DEBEN eliminarse.
- **FR-050**: Los errores mostrados al usuario DEBEN ser claros y no revelar información interna del sistema.
- **FR-051**: Las pruebas automáticas de esta funcionalidad DEBEN ejecutarse únicamente contra la base de pruebas `gymaccess_test` y cubrir permisos por rol, reglas de negocio, el registro de todos los intentos de acceso y que ninguna respuesta exponga datos biométricos.
- **FR-052**: La biblioteca de reconocimiento facial NO DEBE elegirse ni instalarse sin una investigación y justificación documentadas en la planificación, con compatibilidad con el stack, funcionamiento local, cámara, licencia y seguridad.

### Key Entities *(include if feature involves data)*

- **Tipo de membresía**: Plan que ofrece el gimnasio: nombre único, descripción, duración en días, precio y estado (activo o inactivo).
- **Membresía**: Periodo de acceso de un cliente a un plan: cliente, tipo, fecha de inicio, fecha de fin, precio acordado y estado. Su estado real se deriva del estado guardado, las fechas y su pago: pendiente de pago, activa (vigente), vencida, suspendida o cancelada. Un cliente tiene un historial de membresías, a lo más una en curso (vigente o pendiente de pago) y a lo más una renovación futura.
- **Pago**: Pago completo de una membresía: cliente, membresía, monto (igual al precio acordado), método (efectivo, tarjeta o transferencia), fecha y hora, usuario que lo registró. Cada membresía tiene a lo más uno y es inmutable.
- **Adeudo (derivado)**: Precio acordado de una membresía que aún no tiene su pago registrado. No se guarda como dato propio.
- **Rostro registrado**: Información facial protegida de un cliente, con fecha y estado (activo o inactivo). Nunca se expone; solo se informa si existe.
- **Intento de acceso**: Cada vez que alguien se presenta en la estación: fecha, hora, tipo (entrada), resultado (autorizado o rechazado), motivo del rechazo y cliente (si se identificó).
- **Evento de auditoría**: Constancia de una acción importante: usuario, acción, módulo, fecha y hora, resultado y descripción.
- **Periodo del dashboard**: Rango de fechas elegido (hoy, semana, mes en curso o rango) que acota ingresos y accesos.
- **Indicador / tarjeta de Inicio**: Cifra o tarjeta de resumen visible según el rol (accesos de hoy, membresías por vencer, clientes que entraron hoy, tarjetas del cliente).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona del personal asigna una membresía a un cliente y registra su pago completo en menos de 2 minutos.
- **SC-002**: Registrar el rostro de un cliente toma menos de 1 minuto cuando la cámara y la iluminación son adecuadas.
- **SC-003**: En condiciones normales de iluminación, la estación muestra el resultado (autorizado o rechazado) en menos de 3 segundos desde que la persona está frente a la cámara.
- **SC-004**: En la demostración con clientes de prueba, al menos el 95 % de los intentos de clientes registrados con membresía vigente se identifican y autorizan a la primera.
- **SC-005**: Ninguna persona sin rostro registrado y ningún cliente con membresía vencida, suspendida, cancelada, inexistente, pendiente de pago o dado de baja obtiene acceso en las pruebas (0 accesos indebidos).
- **SC-006**: El 100 % de los intentos de acceso, autorizados o rechazados, queda registrado, y el 100 % de los rechazados tiene su motivo.
- **SC-007**: Ninguna pantalla ni respuesta del sistema contiene información facial; esto se verifica en el 100 % de las consultas de prueba.
- **SC-008**: El 100 % de las cifras del Dashboard, de los indicadores del Inicio y de los adeudos coincide con las listas de origen en las pruebas.
- **SC-009**: Cambiar el periodo del Dashboard actualiza las cifras en menos de 3 segundos.
- **SC-010**: Para los 4 roles, el menú y las pantallas muestran exactamente lo permitido en el Anexo, y el 100 % de las operaciones no permitidas es rechazado por el servidor.
- **SC-011**: Un recepcionista nuevo identifica cómo asignar una membresía y registrar un pago en menos de 1 minuto, sin ayuda.
- **SC-012**: Un cliente ve su estado de membresía (vigente, por vencer o vencida) de un vistazo en su Inicio, siempre con color y texto.
- **SC-013**: Todas las acciones listadas en FR-045 dejan su evento de auditoría en el 100 % de las pruebas.
- **SC-014**: Todas las pruebas automáticas del backend y del frontend pasan, incluidas las que usan la base `gymaccess_test`, y las pruebas existentes de los sprints anteriores siguen pasando.
- **SC-015**: Tras 5 rechazos "Rostro no reconocido" consecutivos, la estación se pausa 30 segundos en el 100 % de las pruebas y no registra intentos durante la pausa.

## Assumptions

- Se parte de lo construido en el Sprint 1 y en el rediseño de interfaz (especificaciones `001-base-usuarios-clientes` y `002-interfaz-menu-lateral`), incluidos el menú configurable, el Layout, los componentes comunes y los espacios reservados del Inicio.
- Las tablas necesarias ya existen en `database/migrations/01_esquema_sprint1.sql` y `02_esquema_sprint2.sql`; no se crean tablas nuevas. Para cumplir FR-007 puede hacer falta una **columna** (no una tabla) que conserve el precio acordado de cada membresía; se decidirá y justificará en la planificación con una migración numerada nueva.
- Los métodos de pago son los tres que admite la base de datos: efectivo, tarjeta y transferencia. No hay integración con bancos ni plataformas de pago (fuera del MVP). La moneda se muestra con el símbolo "$".
- Cada membresía se paga una sola vez, por su precio completo: no hay pagos parciales, recargos ni reembolsos. Una membresía solo queda activa cuando su pago está registrado, y las membresías con precio $0 quedan activas sin pago. La base de datos no tiene un estado propio para "pendiente de pago"; se deriva de la ausencia del pago (la planificación decidirá si se deriva o si se agrega ese estado con una migración numerada).
- La membresía vencida no tiene tiempo de tolerancia: el acceso se rechaza desde el día siguiente a su fecha de fin. Una membresía suspendida rechaza el acceso y se reactiva con la misma fecha de fin.
- Se aplica el criterio del acta de entrega: el acceso es solo para clientes al corriente. Un cliente con adeudo (membresía sin pago registrado) NO entra, aunque las fechas de su membresía cubran hoy; confirmado por el equipo el 2026-10-14.
- "Por vencer" significa 5 días o menos para el vencimiento, coherente con el color amarillo del diseño reservado del Inicio del cliente. "Semana" es la semana en curso de lunes a hoy. "Hoy" y las fechas usan la fecha del servidor.
- Los permisos por rol siguen la tabla del Anexo; el recepcionista consulta pagos y adeudos porque debe cobrar y atender al cliente, y el entrenador no accede a información financiera. Si una membresía se asignó por error y no tiene pago, solo un administrador puede cancelarla.
- El registro del rostro requiere confirmar el consentimiento del cliente y guarda solo la información necesaria para identificar, no fotografías; no se conserva ninguna imagen de la cámara de la estación.
- Las decisiones técnicas del reconocimiento facial (biblioteca, dónde se procesa, forma de capturar y proteger la información, umbral de coincidencia, condiciones de iluminación, cámara de pruebas) se investigan y justifican en la planificación; el umbral debe favorecer rechazar ante la duda (nunca autorizar por parecido dudoso).
- La detección de vida (distinguir un rostro real de una fotografía) no se incluye en esta versión; es una limitación conocida que se documenta.
- Solo se atiende la entrada; la salida del gimnasio, múltiples puntos de acceso, múltiples sucursales, reportes avanzados, la pantalla de consulta de auditoría, "Mis clientes asignados" y rutinas (Sprint 3) quedan fuera de este sprint.
- La asignación, renovación y gestión de membresías y el registro del rostro se hacen desde el detalle del cliente; los pagos también pueden registrarse desde la sección Pagos. Los clientes consultan su información de Sprint 2 desde su Inicio, sin menús nuevos.
- Por decisión del equipo (2026-10-14), la pantalla de la estación muestra el nombre y el motivo exacto del rechazo, incluidos los de carácter financiero ("Pago pendiente"). Como cualquier persona cercana puede verla, se recomienda instalar la pantalla de modo que solo la vea quien se presenta; la estación no conserva ni muestra el historial de intentos anteriores.
- Por decisión del equipo (2026-10-14), la información facial de un rostro desactivado se conserva (inactiva y protegida) para poder reactivarla; no hay borrado automático ni eliminación desde el sistema. Quitar por completo la información biométrica de un cliente que lo solicite queda fuera de este sprint y requeriría una intervención administrativa aparte.
- Se trabaja en la rama `feature/sprint-2`. Las pruebas usan únicamente la base `gymaccess_test`; nunca se escriben datos de prueba en `gymaccess`.
- Las decisiones 2 a 6 de la especificación inicial (recepcionista con acceso a Pagos y Adeudos; "por vencer" = 5 días o menos; sin tolerancia para vencidas; espera de 5 y 10 segundos en la estación; falta de detección de vida) fueron confirmadas por el equipo el 2026-10-14. Las aclaraciones de esta sesión resolvieron además las renovaciones por adelantado, lo que muestra la estación al rechazar, la conservación de la información facial al desactivar un rostro y los intentos repetidos. Las demás decisiones abiertas de `docs/sprint-2.md` sección 9 que sean técnicas se resuelven en la planificación.

## Anexo: Secciones del menú y permisos por rol

| Sección | Administrador | Recepcionista | Entrenador | Cliente |
|---|---|---|---|---|
| Inicio | Sí | Sí | Sí | Sí |
| Mi información | No | No | No | Sí |
| Dashboard | Sí | No | No | No |
| Clientes (detalle con membresía, pagos y rostro) | Sí | Sí | Solo consulta básica | No |
| Tipos de membresía | Gestión completa | Solo consulta | No | No |
| Pagos | Sí | Sí (consulta y registro) | No | No |
| Adeudos | Sí | Sí | No | No |
| Accesos | Sí | Sí | Sí (información básica) | No (ve los suyos en el Inicio) |
| Estación de acceso | Sí | Sí | No | No |
| Usuarios y roles | Sí | No | No | No |

Distribución propuesta en el menú: **General** (Inicio, Mi información, Dashboard), **Operación** (Clientes, Accesos, Estación de acceso), **Membresías y pagos** (Tipos de membresía, Pagos, Adeudos) y **Administración** (Usuarios y roles).

## Anexo: Acciones por rol en la gestión de membresías, pagos y rostros

| Acción | Administrador | Recepcionista |
|---|---|---|
| Asignar y renovar una membresía | Sí | Sí |
| Suspender, reactivar y cancelar una membresía (incluida una pendiente de pago asignada por error) | Sí | No |
| Registrar el pago completo de una membresía | Sí | Sí |
| Registrar o reemplazar un rostro | Sí | Sí |
| Desactivar y reactivar un rostro | Sí | No |
| Crear, editar y desactivar tipos de membresía | Sí | No |
| Ver el Dashboard | Sí | No |
