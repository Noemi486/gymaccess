# Feature Specification: Entrenadores, rutinas, progreso y dashboard de entrenamiento (Sprint 3)

**Feature Branch**: `004-entrenadores-rutinas` (rama de trabajo `feature/sprint-3`)

**Created**: 2026-11-03

**Status**: Draft (aseguramiento de calidad hecho el 2026-11-03)

**Input**: `docs/sprint-3.md` con el contexto de `docs/project-context.md`, las specs 001 a 003 y la salida del gimnasio que la spec 003 (FR-066) dejó para este sprint.

## Clarifications

### Session 2026-11-03 (aseguramiento de calidad antes de construir)

- Q: ¿Cómo se da de alta un entrenador? → A: Con un solo formulario en la sección Entrenadores: nombre, correo, contraseña, teléfono y especialidad. Se crean a la vez la cuenta (rol entrenador) y su ficha.
- Q: ¿Qué registra el entrenador como objetivos y progreso? → A: Objetivos con descripción, meta, fecha límite y estado (en curso, cumplido o cancelado). Avances con fecha, peso (kg), % de grasa y cintura (cm) opcionales y un comentario.
- Q: ¿Cuántas rutinas puede tener un cliente a la vez? → A: Una sola rutina activa, con ejercicios organizados por día (Día 1, Día 2…). Al crear una nueva, la anterior queda en el historial.
- Q: ¿Se incluye la salida del gimnasio, que la spec 003 dejó para este sprint? → A: Sí, en versión sencilla: la estación tiene un modo Entrada / Salida; la salida registra la hora sin revisar la membresía.
- Decisiones del análisis (2026-11-03), por ambigüedades de `docs/sprint-3.md`:
  - "Modificar una rutina" crea una **nueva versión** (la anterior se archiva): así se conserva el historial y no se borra ningún ejercicio (la cuenta de la aplicación no tiene DELETE en `gymaccess`).
  - "Progreso médico o deportivo": solo datos deportivos (peso, grasa, cintura y comentario); no se registran diagnósticos ni datos médicos.
  - "Modificar un progreso": solo el entrenador que lo registró y solo el mismo día, para corregir errores de captura; después queda fijo.
  - `estadisticas_dashboard` no será una tabla: las cifras se calculan en el momento, como en el Sprint 2, para que siempre coincidan con su origen.
  - El administrador puede **consultar** (no editar) rutinas, objetivos y progreso para supervisar; el recepcionista solo ve asignaciones y la carga de cada entrenador.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar y administrar entrenadores (Priority: P1)

Como administrador, quiero registrar a los entrenadores del gimnasio para definir quiénes acompañarán a los clientes.

**Why this priority**: Sin entrenadores no hay asignaciones ni rutinas.

**Independent Test**: Registrar un entrenador desde la sección Entrenadores e iniciar sesión con su cuenta.

**Acceptance Scenarios**:

1. **Given** el administrador en "Entrenadores", **When** captura nombre, correo, contraseña válida, teléfono y especialidad y guarda, **Then** se crean la cuenta con rol entrenador y su ficha, y el entrenador puede iniciar sesión.
2. **Given** un correo que ya usa otra cuenta, **When** intenta guardar, **Then** se rechaza indicando el campo, y no se crea nada (ni cuenta ni ficha).
3. **Given** un entrenador, **When** el administrador edita su nombre, teléfono o especialidad, **Then** se guardan los cambios.
4. **Given** un entrenador sin clientes asignados, **When** el administrador lo desactiva (con confirmación), **Then** su cuenta queda inactiva y ya no puede iniciar sesión ni recibir asignaciones; puede reactivarse.
5. **Given** un entrenador con clientes asignados, **When** el administrador intenta desactivarlo (desde Entrenadores o desde Usuarios y roles), **Then** se rechaza con "Reasigna primero sus N clientes".
6. **Given** el recepcionista, **When** abre "Entrenadores", **Then** ve la lista con el número de clientes de cada uno, sin poder crear, editar ni desactivar.

---

### User Story 2 - Asignar un entrenador a un cliente (Priority: P1)

Como administrador o recepcionista, quiero asignar un entrenador a un cliente para que alguien se haga responsable de su seguimiento.

**Why this priority**: La asignación define qué clientes puede atender cada entrenador.

**Independent Test**: Asignar, cambiar y quitar el entrenador de un cliente desde su detalle y comprobar el historial.

**Acceptance Scenarios**:

1. **Given** un cliente activo sin entrenador, **When** el personal elige un entrenador activo en el detalle del cliente y confirma, **Then** queda asignado con la fecha de hoy.
2. **Given** un cliente con entrenador, **When** el personal elige otro, **Then** la asignación anterior se cierra con la fecha de hoy y empieza la nueva; nunca hay dos activas.
3. **Given** un cliente con entrenador, **When** el personal lo quita (con confirmación), **Then** la asignación se cierra y el cliente queda sin entrenador.
4. **Given** un cliente dado de baja, un cliente inexistente, un entrenador inactivo o una cuenta que no es de entrenador, **When** se intenta asignar, **Then** se rechaza con un mensaje claro.
5. **Given** el detalle de un cliente, **When** se consulta, **Then** muestra su entrenador actual y el historial de asignaciones (entrenador, desde, hasta).
6. **Given** un entrenador o un cliente, **When** intenta asignar, **Then** el servidor lo rechaza (403).

---

### User Story 3 - Crear rutinas para los clientes asignados (Priority: P1)

Como entrenador, quiero crear rutinas personalizadas para mis clientes asignados para orientar su entrenamiento.

**Why this priority**: Es el núcleo del sprint.

**Independent Test**: Con un cliente asignado, crear una rutina de dos días con ejercicios, crear otra versión y comprobar que la primera queda en el historial.

**Acceptance Scenarios**:

1. **Given** un entrenador en "Mis clientes", **When** abre un cliente asignado, **Then** ve su rutina activa (si tiene), el historial de rutinas, sus objetivos y su progreso.
2. **Given** un cliente asignado sin rutina, **When** el entrenador captura nombre de la rutina, indicaciones opcionales y ejercicios por día (nombre, series, repeticiones, peso, descanso o instrucciones) y guarda, **Then** queda como su rutina activa.
3. **Given** un ejercicio sin series ni repeticiones ni instrucciones, **When** se intenta guardar, **Then** se rechaza indicando el ejercicio.
4. **Given** un cliente con rutina activa, **When** el entrenador la modifica y guarda, **Then** se crea una nueva versión activa y la anterior queda archivada, consultable y sin cambios.
5. **Given** un cliente que no está asignado al entrenador (o que lo estuvo antes), **When** el entrenador intenta ver o crear su rutina, **Then** el servidor lo rechaza (403).
6. **Given** un cliente dado de baja, **When** el entrenador intenta crear una rutina, **Then** se rechaza; lo ya registrado sigue consultable.

---

### User Story 4 - Registrar objetivos y progreso (Priority: P1)

Como entrenador, quiero registrar objetivos y avances de mis clientes para seguir su evolución de forma medible.

**Why this priority**: Junto con la rutina, completa el seguimiento.

**Independent Test**: Crear un objetivo, registrar tres avances en fechas distintas, marcar el objetivo como cumplido y revisar el historial.

**Acceptance Scenarios**:

1. **Given** un cliente asignado, **When** el entrenador registra un objetivo con descripción, meta opcional y fecha límite opcional, **Then** queda "En curso".
2. **Given** un objetivo en curso, **When** el entrenador lo marca como cumplido o cancelado, **Then** cambia de estado con su fecha de cierre y ya no puede editarse.
3. **Given** un cliente asignado, **When** el entrenador registra un avance con fecha (hoy o anterior) y al menos uno de peso, % de grasa, cintura o comentario, **Then** se guarda en el historial.
4. **Given** valores fuera de rango (peso fuera de 20 a 400 kg, grasa fuera de 2 a 70 %, cintura fuera de 30 a 250 cm) o una fecha futura, **When** se intenta guardar, **Then** se rechaza indicando el campo.
5. **Given** el historial de avances, **When** se consulta, **Then** se ordena del más reciente al más antiguo y muestra la diferencia de peso, grasa y cintura con el avance anterior que tenga ese dato.
6. **Given** un avance registrado hoy por el mismo entrenador, **When** lo corrige, **Then** se guarda; un avance de otro día o de otro entrenador no puede corregirse.
7. **Given** el recepcionista, **When** intenta crear o modificar objetivos o avances, **Then** el servidor lo rechaza (403).

---

### User Story 5 - El cliente consulta su rutina y su progreso (Priority: P2)

Como cliente, quiero consultar mi rutina y mi progreso para conocer mi evolución y mantenerme motivado.

**Why this priority**: Da valor al cliente, pero depende de lo que registra el entrenador.

**Independent Test**: Iniciar sesión como cliente con rutina y progreso, y como cliente sin entrenador.

**Acceptance Scenarios**:

1. **Given** un cliente con entrenador y rutina, **When** abre "Mi entrenamiento", **Then** ve el nombre de su entrenador, su rutina activa organizada por día, sus objetivos con su estado y su historial de avances.
2. **Given** un cliente sin entrenador o sin registros, **When** abre "Mi entrenamiento", **Then** ve estados vacíos claros ("Aún no tienes entrenador asignado. Pregunta en recepción.").
3. **Given** un cliente, **When** consulta su entrenamiento, **Then** solo recibe lo suyo, sin datos de contacto del entrenador ni de otros clientes, y no puede modificar nada.

---

### User Story 6 - Dashboard de entrenamiento (Priority: P2)

Como administrador, quiero ver un resumen de entrenadores, asignaciones y progreso para tomar decisiones operativas.

**Why this priority**: Complementa el Dashboard del Sprint 2.

**Independent Test**: Con datos de prueba conocidos, comprobar cada cifra contra su lista de origen.

**Acceptance Scenarios**:

1. **Given** el administrador en el Dashboard, **When** lo abre, **Then** además de lo del Sprint 2 ve la sección "Entrenamiento": entrenadores activos, clientes activos con entrenador, clientes activos sin entrenador, rutinas activas, objetivos en curso, objetivos cumplidos en el periodo y clientes asignados con al menos un avance en los últimos 30 días.
2. **Given** la sección Entrenamiento, **When** se consulta, **Then** muestra la tabla "Carga por entrenador" (nombre, clientes asignados, rutinas activas y avances registrados en el periodo), sin datos personales de los clientes.
3. **Given** el periodo del Dashboard (hoy, semana, mes o rango), **When** cambia, **Then** solo cambian "objetivos cumplidos en el periodo" y "avances en el periodo"; lo demás es estado actual.
4. **Given** cualquier rol distinto de administrador, **When** consulta el Dashboard, **Then** el servidor lo rechaza (403).

---

### User Story 7 - Consultar los clientes asignados a cada entrenador (Priority: P2)

Como administrador o recepcionista, quiero consultar los clientes asignados a cada entrenador para organizar la carga de trabajo; como entrenador, quiero ver mis clientes asignados.

**Why this priority**: Organiza al equipo y activa "Mis clientes asignados", reservado en el Inicio del entrenador.

**Independent Test**: Abrir el detalle de un entrenador y comparar su lista con las asignaciones activas.

**Acceptance Scenarios**:

1. **Given** el personal en "Entrenadores", **When** abre un entrenador, **Then** ve sus clientes asignados (nombre, estado, desde) con enlace al detalle de cada cliente.
2. **Given** un entrenador, **When** abre "Mis clientes" o su Inicio, **Then** ve solo sus clientes asignados activos con enlace a su entrenamiento, y el número total.
3. **Given** la lista de un entrenador, **When** se compara con las asignaciones activas, **Then** coinciden al 100 %.

---

### User Story 8 - Registrar la salida del gimnasio (Priority: P3)

Como recepcionista, quiero registrar también la salida de los clientes en la Estación de acceso para saber quién sigue dentro.

**Why this priority**: Quedó pendiente de la spec 003; no afecta la regla de acceso.

**Independent Test**: Cambiar la estación a "Salida", identificar a un cliente y comprobar el registro en Accesos.

**Acceptance Scenarios**:

1. **Given** la Estación de acceso, **When** el personal elige el modo "Salida", **Then** la pantalla lo indica claramente (texto y color distintos del modo Entrada) y se mantiene hasta cambiarlo.
2. **Given** el modo Salida, **When** un cliente registrado se identifica, **Then** se registra un acceso de tipo salida, autorizado, con fecha y hora, sin revisar la membresía, y la pantalla muestra "Hasta luego, [nombre]".
3. **Given** el modo Salida, **When** el rostro no se reconoce, **Then** se registra un intento de salida rechazado con "Rostro no reconocido" y aplican la espera de 10 s y la pausa tras 3 intentos (FR-032 y FR-053 de la spec 003).
4. **Given** la pantalla Accesos, **When** se consulta, **Then** muestra el tipo (Entrada o Salida) y permite filtrar por tipo.
5. **Given** las cifras del Sprint 2 (accesos de hoy, clientes que entraron hoy, accesos del Dashboard, últimas visitas del cliente), **When** hay salidas registradas, **Then** solo cuentan las entradas.

---

### Edge Cases

- ¿Qué pasa si dos personas asignan entrenador al mismo cliente a la vez? Solo queda una asignación activa (la base lo impide); la otra recibe un aviso de que el cliente ya cambió.
- ¿Qué pasa con la rutina y el progreso si el cliente cambia de entrenador? Se conservan: son del cliente. El nuevo entrenador ve todo el historial; el anterior pierde el acceso.
- ¿Qué pasa si se desactiva la cuenta de un entrenador desde Usuarios y roles teniendo clientes? Se rechaza igual que desde Entrenadores.
- ¿Qué pasa si un cliente con entrenador se da de baja? La asignación sigue registrada pero el cliente deja de aparecer en "Mis clientes"; si se reactiva, vuelve a aparecer con el mismo entrenador.
- ¿Qué pasa si una rutina tiene días sin ejercicios? Solo se guardan los días con al menos un ejercicio; se exige al menos uno en total.
- ¿Qué pasa con rutinas muy largas? Máximo 7 días y 20 ejercicios por día.
- ¿Qué pasa si se registran dos avances el mismo día? Se permite; se ordenan por fecha y hora de registro.
- ¿Qué pasa si un cliente sale sin haber registrado su entrada? Se registra la salida igual; no se valida la secuencia.
- ¿Qué pasa si alguien sale en modo Entrada por error? Se evalúa como entrada; el personal debe cambiar el modo. El modo activo siempre está a la vista.

## Requirements *(mandatory)*

### Functional Requirements

**Entrenadores (US1)**

- **FR-001**: El administrador DEBE poder registrar un entrenador con un solo formulario (nombre, correo, contraseña con la política existente, teléfono opcional y especialidad opcional de hasta 100 caracteres); el sistema DEBE crear en una sola operación la cuenta con rol entrenador y su ficha, o ninguna de las dos.
- **FR-002**: El administrador DEBE poder editar nombre, teléfono y especialidad de un entrenador, y desactivar o reactivar su cuenta con confirmación. Un entrenador con clientes asignados activos NO DEBE poder desactivarse por ninguna vía (mensaje con el número de clientes).
- **FR-003**: La sección "Entrenadores" DEBE listar los entrenadores (nombre, correo, especialidad, estado y número de clientes asignados) con búsqueda y paginación; el administrador la gestiona y el recepcionista solo la consulta. Una cuenta con rol entrenador creada antes desde "Usuarios y roles" DEBE aparecer en la lista con ficha vacía (teléfono y especialidad sin capturar) y poder completarse.
- **FR-004**: Las cuentas de entrenador NO DEBEN eliminarse; la baja es lógica.

**Asignaciones (US2, US7)**

- **FR-005**: Administrador y recepcionista DEBEN poder asignar, cambiar y quitar el entrenador de un cliente activo desde su detalle, con confirmación al cambiar o quitar. Solo se asignan entrenadores con cuenta activa y rol entrenador.
- **FR-006**: Un cliente DEBE tener a lo más una asignación activa; cambiar de entrenador DEBE cerrar la anterior y abrir la nueva en una sola operación. Las asignaciones cerradas se conservan como historial con fecha de inicio y de fin.
- **FR-007**: El detalle del cliente DEBE mostrar el entrenador actual y el historial de asignaciones al administrador y al recepcionista; el entrenador ve solo el nombre de su propio cliente asignado.
- **FR-008**: El detalle de un entrenador DEBE listar sus clientes asignados activos (nombre, estado, desde), y su número DEBE coincidir con las asignaciones activas.

**Rutinas (US3)**

- **FR-009**: Un entrenador DEBE poder crear la rutina de un cliente que tenga asignado y activo: nombre (obligatorio, hasta 100 caracteres), indicaciones generales opcionales (hasta 500) y de 1 a 7 días con 1 a 20 ejercicios cada uno.
- **FR-010**: Cada ejercicio DEBE tener nombre (hasta 100 caracteres) y al menos uno de: series (1 a 20), repeticiones (texto de hasta 30, por ejemplo "10-12" o "30 s") o instrucciones (hasta 300); opcionalmente peso en kg (0 a 500) y descanso en segundos (0 a 600).
- **FR-011**: Un cliente DEBE tener a lo más una rutina activa. Crear una rutina o modificar la activa DEBE crear una nueva versión activa y archivar la anterior en la misma operación. Las rutinas archivadas NO DEBEN modificarse y se conservan como historial (fecha de creación, entrenador y ejercicios).

**Objetivos y progreso (US4)**

- **FR-012**: Un entrenador DEBE poder registrar objetivos de su cliente asignado (descripción obligatoria hasta 200 caracteres, meta opcional hasta 100, fecha límite opcional no anterior a hoy), editarlos mientras están en curso y marcarlos como cumplidos o cancelados (guarda la fecha de cierre; después no se editan).
- **FR-013**: Un entrenador DEBE poder registrar avances de su cliente asignado: fecha (hoy o anterior, no anterior a la fecha de registro del cliente), peso en kg (20 a 400), % de grasa (2 a 70), cintura en cm (30 a 250) y comentario (hasta 500), con al menos uno de ellos.
- **FR-014**: Solo el entrenador que registró un avance DEBE poder corregirlo, y solo el mismo día en que lo registró; los avances NO DEBEN eliminarse.
- **FR-015**: El historial de avances DEBE mostrarse del más reciente al más antiguo, con la diferencia de cada medida respecto al avance anterior que tenga esa medida.
- **FR-016**: Rutinas, objetivos y avances DEBEN guardar el entrenador que los registró; si el cliente cambia de entrenador, el historial se conserva y lo ve el entrenador nuevo.

**Permisos (todas las historias)**

- **FR-017**: El entrenador DEBE poder consultar y registrar rutinas, objetivos y avances únicamente de los clientes que tiene asignados en ese momento; cualquier otro cliente DEBE rechazarse en el servidor (403), incluidos los que tuvo antes.
- **FR-018**: El administrador DEBE poder consultar, sin modificar, la rutina, los objetivos y el progreso de cualquier cliente. El recepcionista NO DEBE acceder a rutinas, objetivos ni progreso, solo a asignaciones y a la carga de cada entrenador.
- **FR-019**: El cliente DEBE consultar únicamente su propio entrenamiento en "Mi entrenamiento" (entrenador asignado por nombre, rutina activa por día, objetivos e historial de avances), sin modificar nada y sin datos de contacto del entrenador; el servidor DEBE tomar su identidad de la sesión.
- **FR-020**: Los permisos de cada operación DEBEN validarse en el servidor; ocultar opciones en la interfaz NO es suficiente.

**Dashboard (US6)**

- **FR-021**: El Dashboard del administrador DEBE agregar la sección "Entrenamiento" con: entrenadores activos, clientes activos con entrenador, clientes activos sin entrenador, rutinas activas, objetivos en curso, objetivos cumplidos en el periodo, y clientes asignados con al menos un avance en los últimos 30 días (número y porcentaje).
- **FR-022**: La sección DEBE incluir la tabla "Carga por entrenador": nombre, clientes asignados, rutinas activas y avances registrados en el periodo; solo entrenadores activos, ordenados por clientes asignados (de más a menos).
- **FR-023**: Las cifras DEBEN calcularse en el momento a partir de las tablas (no se guardan estadísticas) y coincidir con sus listas de origen; el servidor DEBE rechazar a cualquier rol que no sea administrador.

**Inicio y menú**

- **FR-024**: El Inicio del entrenador DEBE activar "Mis clientes asignados" (reservado en la spec 002): número de clientes asignados y la lista (nombre y estado) con enlace a su entrenamiento.
- **FR-025**: El menú DEBE agregar: "Entrenadores" (administrador y recepcionista, bloque Operación), "Mis clientes" (entrenador, bloque Operación) y "Mi entrenamiento" (cliente, bloque General), usando la configuración de menú existente.

**Salida del gimnasio (US8)**

- **FR-026**: La Estación de acceso DEBE tener un selector de modo Entrada / Salida, visible en todo momento (texto y color distintos), que empieza en Entrada cada vez que se abre.
- **FR-027**: En modo Salida, un cliente identificado DEBE registrarse como acceso de tipo salida, autorizado, sin revisar membresía ni estado del cliente, mostrando "Hasta luego, [nombre]"; un rostro no reconocido DEBE registrarse como salida rechazada con "Rostro no reconocido". Aplican la espera de 10 s por persona y la pausa tras 3 rechazos de la spec 003.
- **FR-028**: La pantalla Accesos DEBE mostrar el tipo y permitir filtrar por tipo (Entrada, Salida o todos). Los indicadores de la spec 003 basados en accesos (accesos de hoy, clientes que entraron hoy, accesos autorizados y rechazados del Dashboard, accesos recientes y últimas visitas del cliente) DEBEN contar solo entradas.

**Auditoría, datos y calidad**

- **FR-029**: DEBEN registrarse eventos de auditoría (usuario, acción, módulo, fecha, resultado y descripción sin datos de salud) para: crear, editar, desactivar y reactivar entrenadores; asignar, cambiar y quitar entrenador; crear y versionar rutinas; crear, editar, cumplir y cancelar objetivos; registrar y corregir avances. Los intentos de salida no generan auditoría (ya quedan en accesos).
- **FR-030**: Este sprint DEBE agregar las tablas `entrenadores`, `asignaciones_entrenador`, `rutinas`, `ejercicios_rutina`, `objetivos_entrenamiento` y `progresos_clientes` con un script de migración nuevo (`database/migrations/03_esquema_sprint3.sql`) que no borre ni modifique lo existente; `estadisticas_dashboard` NO se crea (FR-023). La base de pruebas DEBE recibir las mismas tablas.
- **FR-031**: Ningún registro de este sprint DEBE eliminarse: las bajas y cierres son por estado y fecha.
- **FR-032**: Todas las pantallas nuevas DEBEN usar los componentes y el sistema visual existentes, con textos en español, estados vacíos, errores por campo y adaptables de 360 a 1920 px.
- **FR-033**: Las pruebas automáticas DEBEN ejecutarse solo contra `gymaccess_test` y cubrir permisos por rol (en especial, el entrenador con clientes no asignados), reglas de negocio, versiones de rutina, auditoría y que ninguna respuesta del sprint exponga datos biométricos ni contraseñas.

### Key Entities

- **Entrenador**: Ficha de una cuenta con rol entrenador: teléfono, especialidad y fecha de registro. Su estado es el de su cuenta.
- **Asignación de entrenador**: Relación cliente–entrenador con fecha de inicio, fecha de fin, estado (activa o finalizada) y quién la hizo. A lo más una activa por cliente.
- **Rutina**: Plan de entrenamiento de un cliente hecho por un entrenador: nombre, indicaciones, fecha de creación y estado (activa o archivada). A lo más una activa por cliente.
- **Ejercicio de rutina**: Día (1 a 7), orden, nombre, series, repeticiones, peso, descanso e instrucciones.
- **Objetivo de entrenamiento**: Descripción, meta, fecha límite, estado (en curso, cumplido o cancelado), fechas de creación y cierre y entrenador.
- **Avance (progreso)**: Fecha, peso, % de grasa, cintura, comentario, entrenador y fecha y hora de registro.
- **Acceso (ampliado)**: Ya existente; ahora también de tipo salida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador registra un entrenador listo para iniciar sesión en menos de 1 minuto.
- **SC-002**: El personal asigna o cambia el entrenador de un cliente en menos de 30 segundos desde su detalle.
- **SC-003**: Un entrenador crea una rutina de 3 días con 5 ejercicios cada uno en menos de 5 minutos.
- **SC-004**: En el 100 % de las pruebas, un entrenador recibe 403 al consultar o modificar el entrenamiento de un cliente que no tiene asignado (incluido uno que tuvo antes), y el recepcionista recibe 403 en rutinas, objetivos y avances.
- **SC-005**: En el 100 % de las pruebas, ningún cliente tiene más de una asignación activa ni más de una rutina activa, también con peticiones simultáneas.
- **SC-006**: Tras modificar una rutina N veces, el historial muestra N+1 versiones y las archivadas conservan exactamente sus ejercicios.
- **SC-007**: El cliente ve su rutina y su progreso en menos de 2 segundos y nunca datos de otro cliente (0 casos en las pruebas).
- **SC-008**: El 100 % de las cifras de la sección Entrenamiento del Dashboard coincide con sus listas de origen en las pruebas.
- **SC-009**: El 100 % de las acciones de FR-029 deja su evento de auditoría en las pruebas.
- **SC-010**: En modo Salida, el 100 % de las salidas queda registrado con tipo salida, y ningún indicador de entradas del Sprint 2 las cuenta.
- **SC-011**: Todas las pruebas automáticas del backend y del frontend pasan, incluidas las de los sprints anteriores.

## Assumptions

- Se parte de lo construido en las specs 001, 002 y 003 (rama `feature/sprint-2`); el trabajo sigue en `feature/sprint-3`, creada a partir de ella.
- Las tablas nuevas se crean con `database/migrations/03_esquema_sprint3.sql`, que el equipo ejecuta una vez con su usuario administrador de MySQL sobre `gymaccess` y sobre `gymaccess_test`. La cuenta `gymaccess_app` ya tiene permisos sobre toda la base, por lo que no hace falta otorgar nada nuevo.
- Los datos de entrenamiento son deportivos, no médicos; solo se usan para el seguimiento del cliente (regla del sprint).
- No se incluyen clases grupales, asistencia a sesiones, catálogo de ejercicios, gráficas avanzadas, notificaciones al cliente ni reportes exportables.
- El cliente no elige ni califica a su entrenador; la asignación la hace el personal.
- La salida no exige una entrada previa ni calcula tiempo de permanencia en este sprint.

## Anexo: Permisos por rol del Sprint 3

| Acción | Administrador | Recepcionista | Entrenador | Cliente |
|---|---|---|---|---|
| Ver la sección Entrenadores y la carga de cada uno | Sí | Sí (consulta) | No | No |
| Crear, editar, desactivar y reactivar entrenadores | Sí | No | No | No |
| Asignar, cambiar y quitar entrenador a un cliente | Sí | Sí | No | No |
| Ver "Mis clientes" | No | No | Sí (solo los suyos) | No |
| Crear y versionar rutinas; objetivos; avances | No | No | Sí (solo clientes asignados) | No |
| Consultar rutina, objetivos y progreso de un cliente | Sí (solo lectura) | No | Sí (solo asignados) | Solo los suyos ("Mi entrenamiento") |
| Sección Entrenamiento del Dashboard | Sí | No | No | No |
| Modo Salida en la Estación de acceso | Sí | Sí | No | No |

Menú: **General** (Inicio, Mi información, Mi entrenamiento, Dashboard), **Operación** (Clientes, Mis clientes, Entrenadores, Accesos, Estación de acceso), **Membresías y pagos** y **Administración** sin cambios.
