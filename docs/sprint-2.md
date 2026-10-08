<!--

Plantilla de insumo para /speckit.specify.

NO lo pongas dentro de specs/ (esa carpeta la genera Spec Kit).

-->

# Insumo de especificación - Sprint 2: Membresías, pagos, reconocimiento facial y control de acceso

> **Referencias obligatorias para el agente:**
>
> * Contexto maestro: `docs/project-context.md`
> * Constitución: `docs/reglas.md` (y `.specify/memory/constitution.md` una vez ratificada)
> * Sprint 1: `docs/sprint-1.md`
> * Este documento describe únicamente el alcance de este sprint.

## 1. Contexto del sprint

Este sprint utilizará la base implementada en el Sprint 1 para desarrollar las funciones principales del gimnasio relacionadas con membresías, pagos, reconocimiento facial y control de acceso.

Se implementará la gestión de tipos de membresía, asignación y renovación de membresías, registro de pagos, consulta de pagos y adeudos, registro de información facial, identificación mediante reconocimiento facial y validación de acceso.

El sistema deberá identificar al cliente mediante reconocimiento facial y posteriormente verificar si cuenta con una membresía válida antes de permitir su acceso.

La aplicación mantendrá la arquitectura establecida en el Sprint 1:

* `frontend/`: aplicación React con JavaScript.
* `backend/`: aplicación Node.js + Express con JavaScript.
* `database/`: scripts, migraciones y semillas de MySQL.

El backend utilizará **ES Modules**, mediante `import` y `export`. No se utilizará CommonJS mediante `require()` o `module.exports`.

El archivo `backend/package.json` deberá mantener:

```json
{
  "type": "module"
}
```

El frontend no tendrá acceso directo a MySQL. Toda comunicación con la base de datos se realizará mediante la API REST del backend.

La funcionalidad de reconocimiento facial se implementará en este sprint. La librería específica deberá ser seleccionada y justificada durante la etapa de investigación y planificación, considerando compatibilidad con JavaScript, React, Node.js, funcionamiento local, cámara, requisitos del proyecto y licencia.

El reconocimiento facial se utilizará únicamente para identificar clientes previamente registrados y apoyar el control de acceso. No se utilizará para vigilancia, seguimiento o identificación de personas con fines distintos a los definidos en el sistema.

## 2. Objetivo

Implementar la gestión de membresías y pagos, integrando reconocimiento facial para validar la identidad de los clientes y controlar su acceso al gimnasio de acuerdo con la vigencia de su membresía.

## 3. Historias de usuario del sprint

### US-S2-01 — Registro de tipos de membresía

Como administrador, quiero registrar los diferentes tipos de membresía para definir sus características, duración y precio.

### US-S2-02 — Asignación de membresía

Como administrador o recepcionista, quiero asignar una membresía a un cliente para registrar su periodo de acceso al gimnasio.

### US-S2-03 — Renovación de membresía

Como administrador o recepcionista, quiero renovar la membresía de un cliente para mantener actualizado su periodo de acceso al gimnasio.

### US-S2-04 — Registro de pagos

Como administrador o recepcionista, quiero registrar los pagos realizados por los clientes para mantener un historial financiero.

### US-S2-05 — Consulta de pagos y adeudos

Como administrador, quiero consultar los pagos y adeudos de los clientes para llevar un control financiero del gimnasio.

### US-S2-06 — Registro de información facial

Como administrador o recepcionista autorizado, quiero registrar la información facial de un cliente para permitir su identificación al ingresar al gimnasio.

### US-S2-07 — Identificación mediante reconocimiento facial

Como cliente previamente registrado, quiero utilizar mi rostro para identificarme al ingresar al gimnasio.

### US-S2-08 — Validación de acceso

Como sistema, quiero verificar la membresía del cliente después de identificarlo para determinar si puede ingresar al gimnasio.

### US-S2-09 — Consulta de accesos

Como administrador o recepcionista, quiero consultar los registros de acceso para conocer las entradas autorizadas y los intentos rechazados.

## 4. Flujo demostrable al cierre del sprint

1. El administrador registra los tipos de membresía disponibles.
2. El administrador o recepcionista asigna una membresía a un cliente previamente registrado.
3. El sistema registra las fechas de inicio y finalización de la membresía.
4. Se registra el pago correspondiente.
5. El administrador o recepcionista autorizado registra la información facial del cliente.
6. El cliente llega al acceso del gimnasio.
7. La cámara captura el rostro del cliente.
8. El sistema procesa la imagen mediante la librería de reconocimiento facial seleccionada.
9. El sistema genera o utiliza el descriptor facial correspondiente.
10. El sistema compara la información facial con los registros de clientes autorizados.
11. Si existe una coincidencia válida, el sistema identifica al cliente.
12. El sistema consulta la membresía asociada al cliente.
13. Se verifica el estado y la vigencia de la membresía.
14. Si la membresía es válida, el sistema autoriza el acceso.
15. Si la membresía está vencida, suspendida, cancelada o no existe, el sistema rechaza el acceso.
16. Si el rostro no puede ser identificado, el acceso se rechaza y se registra el motivo correspondiente.
17. El sistema registra cada intento de acceso.
18. Los usuarios autorizados pueden consultar los registros de acceso.

## 5. Entidades y tablas que toca este sprint

| Tabla             | Operaciones principales                                   |
| ----------------- | --------------------------------------------------------- |
| `usuarios`        | Consultar                                                 |
| `clientes`        | Consultar                                                 |
| `tipos_membresia` | Crear, consultar y modificar                              |
| `membresias`      | Crear, consultar y modificar                              |
| `pagos`           | Crear y consultar                                         |
| `rostros`         | Crear, consultar y modificar                              |
| `accesos`         | Crear y consultar                                         |
| `auditoria`       | Según las acciones de auditoría definidas para el sistema |

Las tablas `usuarios` y `clientes` serán utilizadas a partir de la información creada en el Sprint 1.

La tabla `rostros` almacenará únicamente la información necesaria para la identificación facial definida por la solución seleccionada. No se deberán almacenar imágenes faciales sin una justificación técnica y de seguridad.

La tabla `accesos` almacenará los intentos de entrada, incluyendo accesos autorizados y rechazados.

La tabla `auditoria` se utilizará de acuerdo con las reglas establecidas en `docs/project-context.md` y `docs/reglas.md`.

## 6. Reglas de negocio aplicables

* Una membresía debe estar asociada a un cliente existente.
* La membresía debe utilizar un tipo de membresía válido.
* Toda membresía debe tener una fecha de inicio y una fecha de finalización.
* Una membresía puede encontrarse en estado activa, vencida, suspendida o cancelada.
* Los pagos deben relacionarse con el cliente y la membresía correspondiente.
* El historial de pagos no debe eliminarse de manera ordinaria.
* Para permitir el acceso, el cliente debe tener una membresía válida.
* Una membresía vencida, suspendida, cancelada o inexistente debe provocar el rechazo del acceso.
* El cliente debe estar registrado antes de asociar información facial.
* La información facial solo podrá registrarse para clientes previamente registrados.
* La identificación facial debe realizarse antes de validar la membresía.
* Cada intento de acceso debe registrarse.
* Los accesos rechazados deben almacenar el motivo del rechazo.
* La información facial únicamente debe utilizarse para identificación y control de acceso.
* Los permisos deben validarse en el backend.
* La información biométrica debe mantenerse protegida.
* El reconocimiento facial no debe utilizarse para vigilancia o seguimiento de clientes.
* Solo se permitirá el acceso cuando exista una coincidencia facial válida y una membresía vigente.
* Si no se encuentra una coincidencia facial válida, el acceso deberá rechazarse.
* Los datos biométricos no deberán exponerse mediante endpoints públicos.
* Las consultas a MySQL deberán utilizar parámetros.
* El frontend no tendrá acceso directo a la base de datos.

## 7. Criterios de aceptación

### 7.1 Membresías

* [ ] El administrador puede registrar tipos de membresía.
* [ ] Se pueden consultar los tipos de membresía.
* [ ] Se pueden modificar los tipos de membresía.
* [ ] El administrador o recepcionista puede asignar membresías.
* [ ] El sistema registra correctamente las fechas de inicio y finalización.
* [ ] El sistema identifica correctamente el estado de la membresía.
* [ ] Se pueden renovar membresías.
* [ ] Una membresía queda relacionada con un cliente existente.

### 7.2 Pagos

* [ ] El administrador o recepcionista puede registrar pagos.
* [ ] Los pagos quedan asociados al cliente y a la membresía correspondiente.
* [ ] El administrador puede consultar el historial de pagos.
* [ ] El sistema permite identificar adeudos de acuerdo con la información registrada.
* [ ] Los registros históricos de pagos no se eliminan de manera ordinaria.

### 7.3 Reconocimiento facial

* [ ] Se selecciona y documenta una librería compatible con el proyecto.
* [ ] La librería seleccionada puede integrarse con la arquitectura React + Node.js.
* [ ] Se puede utilizar una cámara compatible para realizar la captura.
* [ ] Se puede registrar la información facial de un cliente previamente registrado.
* [ ] La información facial se relaciona correctamente con el cliente.
* [ ] El sistema puede procesar la información capturada.
* [ ] El sistema puede identificar a un cliente previamente registrado.
* [ ] El sistema puede rechazar una identificación cuando no existe una coincidencia válida.
* [ ] La información biométrica se almacena de forma protegida.
* [ ] Los datos biométricos no se exponen directamente al frontend ni mediante endpoints públicos.
* [ ] El sistema no utiliza reconocimiento facial para vigilancia o seguimiento.

### 7.4 Control de acceso

* [ ] El sistema verifica la membresía después de identificar al cliente.
* [ ] Se permite el acceso cuando la membresía está vigente y activa.
* [ ] Se rechaza el acceso cuando la membresía está vencida.
* [ ] Se rechaza el acceso cuando la membresía está suspendida.
* [ ] Se rechaza el acceso cuando la membresía está cancelada.
* [ ] Se rechaza el acceso cuando el cliente no tiene una membresía válida.
* [ ] Se rechaza el acceso cuando el rostro no puede ser identificado.
* [ ] Los accesos autorizados quedan registrados.
* [ ] Los accesos rechazados quedan registrados con su motivo.
* [ ] Los usuarios autorizados pueden consultar los registros de acceso.

### 7.5 Arquitectura y seguridad

* [ ] El frontend se comunica con el backend mediante API REST.
* [ ] El frontend no accede directamente a MySQL.
* [ ] El backend es el único componente con acceso directo a MySQL.
* [ ] Los permisos se validan en el backend.
* [ ] Se mantiene la autenticación mediante JWT.
* [ ] Las contraseñas continúan protegidas mediante `bcrypt`.
* [ ] El backend continúa utilizando ES Modules.
* [ ] Los archivos JavaScript utilizan `import` y `export`.
* [ ] No se utiliza `require()` ni `module.exports`.
* [ ] Los datos sensibles utilizan variables de entorno.
* [ ] Los datos biométricos se protegen de acuerdo con las reglas del proyecto.

## 8. Fuera de alcance

En este sprint no se implementará:

* Dashboard avanzado.
* Reportes avanzados.
* Aplicación móvil.
* Gestión de múltiples sucursales.
* Nómina.
* Inventario.
* Contabilidad completa.
* Facturación electrónica.
* Procesamiento directo de pagos mediante bancos o plataformas externas.
* Vigilancia mediante reconocimiento facial.
* Seguimiento o rastreo facial de clientes.
* Identificación facial de personas no registradas para fines diferentes al acceso.
* Reconocimiento facial en espacios distintos al punto de acceso definido.
* Funciones que no formen parte del MVP definido en `docs/project-context.md`.
* Funcionalidades que requieran servicios externos no aprobados por el equipo.

El reconocimiento facial de este sprint se limita a la identificación de clientes previamente registrados para validar su acceso al gimnasio.

## 9. Decisiones pendientes para `/speckit.clarify`

Las siguientes decisiones deberán resolverse antes de la implementación definitiva:

* Librería de reconocimiento facial para JavaScript.
* Compatibilidad de la librería con React y Node.js.
* Lugar donde se ejecutará el procesamiento facial: frontend, backend o combinación de ambos.
* Forma de captura mediante cámara.
* Forma de almacenamiento de los descriptores faciales.
* Protección de los datos biométricos.
* Si se almacenarán únicamente descriptores o también imágenes temporales.
* Umbral de coincidencia del reconocimiento facial.
* Condiciones mínimas de iluminación.
* Cámara que se utilizará para las pruebas.
* Manejo de intentos fallidos de reconocimiento facial.
* Número máximo de intentos permitidos.
* Mensaje que se mostrará cuando no se reconozca al cliente.
* Métodos de pago disponibles.
* Manejo de pagos parciales.
* Política para membresías suspendidas.
* Tiempo de tolerancia para membresías vencidas, en caso de existir.
* Política para renovar una membresía antes de que finalice.
* Reglas específicas de auditoría que serán funcionales en este sprint.

La librería de reconocimiento facial **no deberá seleccionarse ni instalarse de forma arbitraria**. Debe quedar documentada y justificada en la investigación y planificación del Sprint 2 antes de su implementación.

## 10. Restricciones técnicas heredadas

El Sprint 2 deberá mantener todas las restricciones establecidas en el Sprint 1, `docs/reglas.md` y `docs/project-context.md`.

### Frontend

* React.
* JavaScript.
* API REST para comunicarse con el backend.
* Sin conexión directa a MySQL.
* Interfaz sencilla y consistente.

### Backend

* Node.js.
* Express.
* JavaScript.
* ES Modules.
* Uso obligatorio de `import` y `export`.
* `backend/package.json` con `"type": "module"`.
* No utilizar `require()` ni `module.exports`.
* API REST.
* JWT para autenticación.
* `bcrypt` para protección de contraseñas.
* Validación de permisos en backend.
* Separación entre rutas, controladores, servicios, modelos y middlewares.

### Base de datos

* MySQL local.
* Motor InnoDB.
* Codificación `utf8mb4`.
* Claves primarias y foráneas.
* Integridad referencial.
* Consultas parametrizadas.
* Scripts SQL versionados.
* Carpeta oficial: `database/`.
* No crear una carpeta alternativa `dataBase/`.

### Reconocimiento facial

* Se deberá utilizar una librería compatible con JavaScript y con la arquitectura seleccionada.
* La librería deberá ser seleccionada y justificada antes de la implementación.
* El procesamiento facial deberá cumplir las reglas de seguridad del proyecto.
* Los datos biométricos deberán mantenerse protegidos.
* La información facial únicamente se utilizará para identificación y control de acceso.
* No se implementará vigilancia ni seguimiento facial.
* El sistema deberá trabajar únicamente con clientes previamente registrados.
* El reconocimiento facial deberá estar integrado con la validación de membresía.
* Una coincidencia facial por sí sola no será suficiente para permitir el acceso.

### Seguridad

* Las credenciales deberán manejarse mediante variables de entorno.
* `.env` deberá estar incluido en `.gitignore`.
* `.env.example` no deberá contener secretos.
* Las contraseñas no deberán almacenarse en texto plano.
* Los permisos deberán validarse en el backend.
* Los errores no deberán revelar información interna.
* Los datos biométricos deberán contar con medidas de protección adecuadas.
* Los registros históricos de pagos y accesos no deberán eliminarse normalmente.

### Git y organización

* El desarrollo deberá realizarse mediante ramas de Git.
* No se deberá trabajar directamente sobre `main`.
* La documentación y los nombres definidos para el proyecto deberán mantenerse en español.
* No se deberán introducir tecnologías o dependencias no justificadas.
* La estructura de carpetas del Sprint 1 deberá mantenerse.

La estructura general continuará siendo:

```text
gym-system/
├── docs/
│   ├── reglas.md
│   ├── project-context.md
│   ├── sprint-1.md
│   └── sprint-2.md
│
├── frontend/
│   ├── package.json
│   ├── index.html
│   └── src/
│
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── config/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── models/
│       ├── middlewares/
│       ├── validators/
│       └── utils/
│
├── database/
│   ├── README.md
│   ├── migrations/
│   ├── seeds/
│   └── scripts/
│
├── .env.example
├── .gitignore
└── README.md
```

No deberán crearse estructuras alternativas como `client/`, `server/` o `dataBase/`.

El Sprint 2 deberá utilizar la base de usuarios y clientes desarrollada en el Sprint 1 y completar las funcionalidades de membresías, pagos, reconocimiento facial y control de acceso definidas en este documento.
