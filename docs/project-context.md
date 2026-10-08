# Contexto Maestro del Proyecto

## 1. Información general del proyecto

**Nombre del proyecto:**
Sistema de Gestión de Acceso y Control Financiero para Gimnasio con Reconocimiento Facial

**Tipo de proyecto:**
Proyecto académico de Ingeniería en Sistemas Computacionales.

**Propósito:**
Desarrollar un sistema web que permita administrar la información de los clientes de un gimnasio, sus membresías, pagos y accesos, utilizando reconocimiento facial para facilitar la identificación y validar si un cliente cuenta con una membresía vigente.

El sistema busca centralizar la información del gimnasio y facilitar las actividades administrativas, reduciendo el registro manual y permitiendo consultar de manera organizada la información de clientes, membresías, pagos y accesos.

---

## 2. Objetivo general

Desarrollar un sistema de gestión para un gimnasio que permita administrar clientes, membresías, pagos y accesos mediante reconocimiento facial, con el fin de facilitar el control de la información y mejorar la gestión de las operaciones del establecimiento.

---

## 3. Objetivos específicos

1. Diseñar un módulo para registrar, consultar y actualizar la información de los clientes.

2. Implementar un módulo para administrar los diferentes tipos de membresía y su vigencia.

3. Desarrollar un módulo para registrar y consultar los pagos realizados por los clientes.

4. Integrar reconocimiento facial para identificar a los clientes registrados.

5. Implementar un mecanismo de validación que determine si un cliente puede ingresar de acuerdo con la vigencia de su membresía.

6. Registrar los accesos autorizados y rechazados.

7. Establecer roles y permisos para controlar las funciones disponibles para cada tipo de usuario.

8. Generar información que permita consultar el estado de clientes, membresías, pagos y accesos.

9. Implementar un dashboard administrativo con información general del funcionamiento del gimnasio.

---

## 4. Alcance del proyecto

El sistema permitirá administrar las principales operaciones relacionadas con los clientes y el acceso al gimnasio.

El MVP contempla:

* Inicio de sesión.
* Gestión de usuarios.
* Gestión de roles.
* Registro y administración de clientes.
* Gestión de tipos de membresía.
* Asignación de membresías a clientes.
* Renovación de membresías.
* Consulta del estado de las membresías.
* Registro de pagos.
* Consulta de pagos y adeudos.
* Registro de información facial.
* Identificación mediante reconocimiento facial.
* Validación de acceso.
* Registro de accesos autorizados y rechazados.
* Dashboard administrativo.
* Reportes básicos.
* Registro de auditoría.

---

## 5. Fuera del alcance del MVP

Las siguientes funciones no forman parte del MVP:

* Administración de múltiples sucursales.
* Aplicación móvil independiente para Android o iOS.
* Sistema de nómina.
* Administración de empleados como sistema de recursos humanos.
* Inventario de productos.
* Venta de productos.
* Contabilidad completa.
* Facturación electrónica.
* Procesamiento directo de pagos con bancos.
* Integración obligatoria con plataformas externas de pago.
* Sistema de vigilancia mediante cámaras.
* Seguimiento de personas mediante reconocimiento facial.
* Reconocimiento facial con fines diferentes al acceso al gimnasio.

Estas funciones podrían considerarse para futuras versiones.

---

# 6. Usuarios y roles

El sistema contará con cuatro tipos principales de usuarios.

## 6.1 Administrador

El administrador tendrá el nivel más alto de permisos dentro del sistema.

Podrá:

* Gestionar usuarios.
* Asignar roles.
* Registrar, modificar y consultar clientes.
* Gestionar tipos de membresía.
* Asignar y renovar membresías.
* Registrar y consultar pagos.
* Consultar adeudos.
* Gestionar información facial.
* Consultar accesos.
* Consultar dashboard.
* Generar reportes.
* Consultar auditoría.

---

## 6.2 Recepcionista

El recepcionista tendrá permisos relacionados principalmente con la atención y administración diaria de los clientes.

Podrá:

* Registrar clientes.
* Modificar información de clientes.
* Consultar clientes.
* Registrar membresías.
* Renovar membresías.
* Registrar pagos.
* Consultar información de membresías.
* Registrar información facial.
* Consultar accesos.

No podrá administrar usuarios ni roles ni consultar información administrativa que corresponda exclusivamente al administrador.

---

## 6.3 Entrenador

El entrenador tendrá acceso únicamente a información necesaria para apoyar la atención de los clientes.

Podrá:

* Consultar clientes.
* Consultar información básica de los clientes.
* Consultar el estado de una membresía.
* Consultar información relacionada con asistencia o accesos.

No tendrá acceso a información financiera ni a la administración de usuarios.

---

## 6.4 Cliente

El cliente solamente podrá consultar su propia información.

Podrá:

* Consultar su perfil.
* Consultar su membresía.
* Consultar la vigencia de su membresía.
* Consultar sus pagos.
* Consultar sus adeudos.
* Consultar su historial de accesos.

No podrá consultar información de otros clientes ni administrar información del sistema.

---

# 7. Módulos del sistema

## 7.1 Autenticación

Permitirá:

* Iniciar sesión.
* Validar credenciales.
* Generar y validar tokens JWT.
* Identificar el rol del usuario.
* Restringir funciones según permisos.

---

## 7.2 Gestión de usuarios

Permitirá al administrador:

* Registrar usuarios.
* Consultar usuarios.
* Modificar usuarios.
* Asignar roles.
* Activar o desactivar usuarios.

---

## 7.3 Gestión de clientes

Permitirá:

* Registrar clientes.
* Consultar clientes.
* Modificar clientes.
* Consultar información individual.
* Relacionar clientes con membresías.
* Relacionar clientes con pagos.
* Relacionar clientes con información facial.

---

## 7.4 Gestión de membresías

Permitirá:

* Registrar tipos de membresía.
* Consultar tipos de membresía.
* Modificar tipos de membresía.
* Asignar una membresía a un cliente.
* Renovar membresías.
* Consultar fechas de inicio y finalización.
* Identificar membresías activas, vencidas, suspendidas o canceladas.

---

## 7.5 Control financiero

Permitirá:

* Registrar pagos.
* Consultar pagos.
* Consultar historial de pagos.
* Consultar adeudos.
* Relacionar pagos con clientes y membresías.
* Consultar información de ingresos registrada por el sistema.

---

## 7.6 Reconocimiento facial

Permitirá:

* Registrar la información facial de un cliente.
* Asociar la información facial con un cliente existente.
* Identificar a un cliente mediante reconocimiento facial.
* Utilizar el resultado de identificación para validar el acceso.

El reconocimiento facial se utilizará únicamente para identificación y control de acceso.

---

## 7.7 Control de acceso

Permitirá:

* Identificar al cliente.
* Consultar su membresía.
* Validar la vigencia de la membresía.
* Autorizar el acceso cuando corresponda.
* Rechazar el acceso cuando la membresía no sea válida.
* Registrar todos los intentos de acceso.
* Registrar el motivo cuando un acceso sea rechazado.

---

## 7.8 Dashboard

El dashboard permitirá al administrador consultar información general del gimnasio, como:

* Cantidad de clientes.
* Membresías activas.
* Membresías vencidas.
* Pagos registrados.
* Información de ingresos.
* Accesos recientes.
* Accesos rechazados.

---

## 7.9 Reportes

Permitirá consultar información relacionada con:

* Clientes.
* Membresías.
* Pagos.
* Adeudos.
* Accesos.

Los reportes se generarán utilizando la información almacenada en la base de datos.

---

## 7.10 Auditoría

Permitirá registrar y consultar acciones importantes realizadas dentro del sistema.

La auditoría podrá incluir:

* Usuario que realizó la acción.
* Acción realizada.
* Fecha y hora.
* Módulo involucrado.
* Resultado de la operación.

La consulta de auditoría será exclusiva del administrador.

---

# 8. Arquitectura del sistema

El sistema utilizará una arquitectura separada en tres partes principales:

```text
┌─────────────────────────┐
│       FRONTEND          │
│ React + JavaScript      │
└────────────┬────────────┘
             │
             │ API REST
             ▼
┌─────────────────────────┐
│        BACKEND          │
│ Node.js + Express       │
│ JavaScript              │
└────────────┬────────────┘
             │
             │ Consultas
             ▼
┌─────────────────────────┐
│       BASE DE DATOS     │
│       MySQL LOCAL       │
└─────────────────────────┘
```

El frontend no tendrá acceso directo a MySQL.

Todas las operaciones relacionadas con la base de datos pasarán por el backend.

---

# 9. Tecnologías

## 9.1 Frontend

* React.
* JavaScript.
* HTML.
* CSS.
* Consumo de API REST.

## 9.2 Backend

* Node.js.
* Express.
* JavaScript.
* ES Modules.

El backend utilizará:

```json
"type": "module"
```

Se utilizarán:

```javascript
import
export
```

No se utilizará:

```javascript
require
module.exports
```

---

## 9.3 Base de datos

* MySQL.
* Ejecución local.
* InnoDB.
* UTF-8 mediante `utf8mb4`.
* Llaves primarias.
* Llaves foráneas.

La base de datos no estará alojada en la nube durante el desarrollo del MVP.

---

## 9.4 Seguridad

* JWT para autenticación.
* bcrypt para protección de contraseñas.
* Variables de entorno para credenciales.
* Validación de información en backend.
* Autorización mediante roles.
* Protección de información facial.

---

# 10. Estructura general del proyecto

La estructura propuesta será:

```text
gym-system/
│
├── docs/
│   ├── constitution.md
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

---

# 11. Reglas generales de seguridad

1. Las contraseñas nunca deben almacenarse en texto plano.

2. Las contraseñas deben protegerse utilizando bcrypt.

3. Los secretos y credenciales deben almacenarse mediante variables de entorno.

4. El archivo `.env` no debe subirse al repositorio.

5. Debe existir un archivo `.env.example` sin información sensible.

6. El backend debe validar los permisos de cada usuario.

7. Ocultar una opción en el frontend no se considera una medida de seguridad suficiente.

8. El frontend nunca debe conectarse directamente a MySQL.

9. No se deben mostrar errores internos ni stack traces al usuario.

10. La información facial debe protegerse y utilizarse únicamente para identificación y control de acceso.

---

# 12. Reglas de negocio

## RN-01 - Registro de clientes

Un cliente debe existir en el sistema antes de poder asignarle una membresía, registrar pagos o asociarle información facial.

## RN-02 - Membresías

Toda membresía debe estar relacionada con un cliente y un tipo de membresía válido.

## RN-03 - Vigencia

Toda membresía debe contar con una fecha de inicio y una fecha de finalización.

## RN-04 - Estado de membresía

Una membresía puede encontrarse en alguno de los siguientes estados:

* Activa.
* Vencida.
* Suspendida.
* Cancelada.

## RN-05 - Pagos

Todo pago debe estar relacionado con un cliente y su membresía correspondiente.

## RN-06 - Historial de pagos

Los pagos registrados forman parte del historial financiero y no deben eliminarse de manera ordinaria.

## RN-07 - Acceso

Un cliente solamente puede ingresar cuando su membresía sea válida y se encuentre vigente.

## RN-08 - Membresía no válida

Una membresía vencida, suspendida, cancelada o inexistente debe provocar el rechazo del acceso.

## RN-09 - Reconocimiento facial

El sistema debe identificar al cliente mediante reconocimiento facial antes de realizar la validación de acceso.

## RN-10 - Registro de acceso

Todos los intentos de acceso deben registrarse.

## RN-11 - Acceso rechazado

Cuando un acceso sea rechazado, debe registrarse el motivo correspondiente.

## RN-12 - Información facial

La información facial solo debe utilizarse para identificación y control de acceso.

## RN-13 - Permisos

Las funciones disponibles deben depender del rol del usuario y los permisos deben validarse desde el backend.

## RN-14 - Información del cliente

Un cliente solamente puede consultar su propia información.

---

# 13. Historias de usuario generales

## Autenticación

* **US-G01** - Como usuario, quiero iniciar sesión para acceder al sistema.

## Usuarios

* **US-G02** - Como administrador, quiero registrar usuarios para permitir el acceso al personal autorizado.

* **US-G03** - Como administrador, quiero asignar roles para controlar los permisos de cada usuario.

## Clientes

* **US-G04** - Como administrador o recepcionista, quiero registrar clientes para mantener su información organizada.

* **US-G05** - Como administrador o recepcionista, quiero modificar clientes para mantener actualizada su información.

* **US-G06** - Como cliente, quiero consultar mi información para conocer mis datos registrados.

## Membresías

* **US-G07** - Como administrador, quiero registrar tipos de membresía para definir los planes disponibles.

* **US-G08** - Como administrador o recepcionista, quiero asignar una membresía a un cliente.

* **US-G09** - Como administrador o recepcionista, quiero renovar una membresía.

## Pagos

* **US-G10** - Como administrador o recepcionista, quiero registrar pagos.

* **US-G11** - Como administrador, quiero consultar pagos y adeudos.

## Reconocimiento facial

* **US-G12** - Como administrador o recepcionista, quiero registrar la información facial de un cliente.

* **US-G13** - Como cliente, quiero identificarme mediante reconocimiento facial al ingresar.

## Acceso

* **US-G14** - Como sistema, quiero validar la membresía del cliente para determinar si puede ingresar.

* **US-G15** - Como administrador o recepcionista, quiero consultar los accesos registrados.

## Dashboard y reportes

* **US-G16** - Como administrador, quiero consultar información general del gimnasio mediante un dashboard.

* **US-G17** - Como administrador, quiero generar reportes de clientes, membresías, pagos y accesos.

## Auditoría

* **US-G18** - Como administrador, quiero consultar la auditoría para conocer las acciones importantes realizadas dentro del sistema.

---

# 14. Entidades y tablas

## 14.1 Tablas principales

| Tabla             | Descripción                                                                    |
| ----------------- | ------------------------------------------------------------------------------ |
| `usuarios`        | Almacena las cuentas de acceso al sistema y sus roles.                         |
| `clientes`        | Almacena la información de los clientes del gimnasio.                          |
| `tipos_membresia` | Contiene los diferentes planes de membresía disponibles.                       |
| `membresias`      | Relaciona un cliente con un tipo de membresía y registra su vigencia.          |
| `pagos`           | Registra los pagos realizados por los clientes.                                |
| `rostros`         | Almacena la información necesaria para identificar facialmente a los clientes. |
| `accesos`         | Registra los intentos de entrada al gimnasio.                                  |
| `auditoria`       | Registra acciones importantes realizadas dentro del sistema.                   |

---

## 14.2 Relaciones principales

```text
USUARIOS
   │
   └── controla el acceso al sistema


CLIENTES
   │
   ├── MEMBRESIAS
   │       │
   │       └── TIPOS_MEMBRESIA
   │
   ├── PAGOS
   │
   ├── ROSTROS
   │
   └── ACCESOS


USUARIOS
   │
   └── AUDITORIA
```

---

## 14.3 Relaciones entre tablas

### usuarios

Contendrá información como:

* `id_usuario`
* `nombre`
* `correo`
* `password`
* `rol`
* `estado`

---

### clientes

Contendrá información como:

* `id_cliente`
* `nombre`
* `apellido`
* `correo`
* `telefono`
* `direccion`
* `fecha_registro`
* `estado`

---

### tipos_membresia

Contendrá información como:

* `id_tipo_membresia`
* `nombre`
* `descripcion`
* `duracion`
* `precio`
* `estado`

---

### membresias

Contendrá información como:

* `id_membresia`
* `id_cliente`
* `id_tipo_membresia`
* `fecha_inicio`
* `fecha_fin`
* `estado`

---

### pagos

Contendrá información como:

* `id_pago`
* `id_cliente`
* `id_membresia`
* `monto`
* `fecha_pago`
* `metodo_pago`
* `estado`

---

### rostros

Contendrá información relacionada con la identificación facial del cliente.

* `id_rostro`
* `id_cliente`
* `descriptor_facial`
* `fecha_registro`
* `estado`

La forma definitiva de almacenar la información facial se definirá durante la etapa de diseño técnico.

---

### accesos

Contendrá información como:

* `id_acceso`
* `id_cliente`
* `fecha`
* `hora`
* `tipo`
* `resultado`
* `motivo_rechazo`

---

### auditoria

Contendrá información como:

* `id_auditoria`
* `id_usuario`
* `accion`
* `modulo`
* `fecha`
* `resultado`
* `descripcion`

---

# 15. Integridad de la base de datos

La base de datos debe utilizar:

* Llaves primarias para identificar registros.
* Llaves foráneas para establecer relaciones.
* Restricciones de integridad referencial.
* InnoDB.
* `utf8mb4`.

Las relaciones principales serán:

```text
clientes
   │
   ├──────────────< membresias
   │                    │
   │                    └──── tipos_membresia
   │
   ├──────────────< pagos
   │
   ├──────────────< rostros
   │
   └──────────────< accesos


usuarios
   │
   └──────────────< auditoria
```

---

# 16. Sprints del MVP

El MVP se desarrollará en **dos sprints**.

## Sprint 1 - Base del sistema, usuarios y clientes

### Objetivo

Establecer la estructura inicial del sistema e implementar la autenticación, gestión de usuarios, roles y administración básica de clientes.

### Funcionalidades principales

* Inicio de sesión.
* Usuarios.
* Roles.
* Autenticación JWT.
* Protección de contraseñas con bcrypt.
* Registro de clientes.
* Consulta de clientes.
* Modificación de clientes.
* Consulta de información propia por parte del cliente.
* Estructura inicial de la base de datos MySQL.

---

## Sprint 2 - Membresías, pagos, reconocimiento facial y control de acceso

### Objetivo

Implementar la gestión de membresías y pagos, integrar el reconocimiento facial y establecer el control de acceso de los clientes de acuerdo con la vigencia de su membresía.

### Funcionalidades principales

* Tipos de membresía.
* Registro de membresías.
* Renovación de membresías.
* Registro de pagos.
* Consulta de pagos.
* Consulta de adeudos.
* Registro de información facial.
* Reconocimiento facial.
* Validación de membresías.
* Autorización de acceso.
* Rechazo de acceso.
* Registro de accesos.
* Auditoría.

---

# 17. Criterios generales para considerar terminado el MVP

El MVP se considerará terminado cuando:

* El usuario pueda iniciar sesión.
* Los roles funcionen correctamente.
* Los permisos sean validados en backend.
* Los clientes puedan registrarse y consultarse.
* Las membresías puedan registrarse y renovarse.
* Los pagos puedan registrarse y consultarse.
* Se pueda identificar a un cliente mediante reconocimiento facial.
* El sistema pueda validar la vigencia de la membresía.
* El sistema autorice o rechace el acceso correctamente.
* Los accesos queden registrados.
* La información se almacene correctamente en MySQL.
* Los datos se consulten correctamente.
* Los errores previsibles sean manejados.
* Las funciones principales hayan sido probadas.
* No existan secretos dentro del repositorio.

---

# 18. Decisiones técnicas pendientes

Las siguientes decisiones deben resolverse antes de implementar las partes correspondientes:

* Driver de MySQL para Node.js.
* Uso de driver directo, query builder u ORM.
* Librería de reconocimiento facial compatible con JavaScript.
* Forma definitiva de almacenar la información facial.
* Librería de componentes para React.
* Manejo de estado en React.
* Estrategia de validación de formularios.
* Diseño definitivo del dashboard.
* Formato de los reportes.
* Formato de exportación de reportes.
* Método de pago que se manejará en el sistema.
* Política de pagos parciales.
* Política de membresías suspendidas.
* Tiempo de tolerancia después del vencimiento.
* Tipo de cámara para las pruebas.
* Condiciones necesarias para el reconocimiento facial.

---

# 19. Convenciones de desarrollo

## Código

* El código del backend utilizará ES Modules.
* Los nombres de variables y funciones podrán utilizar términos técnicos en inglés cuando sea necesario.
* La documentación del proyecto se redactará en español.
* Los comentarios del código se escribirán en español.
* Los nombres de las tablas de MySQL se escribirán en minúsculas.
* Las relaciones entre tablas utilizarán llaves primarias y foráneas.

## Git

Las ramas utilizarán:

```text
feature/<nombre>
```

para nuevas funcionalidades.

Para correcciones:

```text
fix/<nombre>
```

No se trabajará directamente sobre `main`.

Los commits deben ser pequeños y relacionados con una sola funcionalidad.

---

# 20. Estructura de la base de datos en el repositorio

Los scripts relacionados con MySQL se almacenarán en:

```text
database/
├── migrations/
├── seeds/
├── scripts/
└── README.md
```

Los cambios de estructura deberán agregarse mediante nuevos scripts numerados.

Los archivos físicos de datos de MySQL no deben almacenarse en Git.

---

# 21. Variables de entorno

La conexión con MySQL deberá utilizar variables de entorno:

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
```

También se podrán agregar variables relacionadas con JWT y otras configuraciones sensibles.

El archivo `.env` no debe subirse al repositorio.

Debe existir:

```text
.env.example
```

sin información sensible.

---

# 22. Principios de desarrollo

1. El frontend y backend deben mantenerse separados.

2. El frontend nunca debe acceder directamente a MySQL.

3. La lógica de negocio debe permanecer principalmente en los servicios del backend.

4. Los controladores deben encargarse de recibir solicitudes y devolver respuestas.

5. Las rutas deben mantenerse organizadas.

6. Los permisos deben validarse en el backend.

7. Las reglas de negocio deben mantenerse consistentes.

8. No se deben agregar funcionalidades fuera del alcance sin aprobación.

9. El desarrollo debe seguir el orden de los sprints.

10. Las funcionalidades deben probarse antes de considerarse terminadas.

---

# 23. Resultado esperado del proyecto

Al finalizar el MVP se espera contar con un sistema web funcional para la administración de un gimnasio.

El flujo principal será:

```text
Registro del cliente
        ↓
Asignación de membresía
        ↓
Registro de pago
        ↓
Registro facial
        ↓
Identificación del cliente
        ↓
Validación de membresía
        ↓
┌─────────────────────┐
│ ¿Membresía vigente? │
└─────────┬───────────┘
          │
     ┌────┴────┐
     │         │
    Sí         No
     │         │
     ▼         ▼
  Acceso    Acceso
 autorizado rechazado
     │         │
     └────┬────┘
          ↓
   Registro del acceso
```

El sistema deberá permitir que el personal autorizado administre la información del gimnasio y que el acceso de los clientes se controle de acuerdo con su identidad y estado de membresía.
