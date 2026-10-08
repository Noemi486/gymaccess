<!--

Plantilla de insumo para /speckit.specify.

NO lo pongas dentro de specs/ (esa carpeta la genera Spec Kit).

-->

# Insumo de especificación - Sprint 1: Base del sistema, usuarios y clientes

> **Referencias obligatorias para el agente:**
>
> * Contexto maestro: `docs/project-context.md`
> * Constitución: `docs/reglas.md` (y `.specify/memory/constitution.md` una vez ratificada)
> * Este documento describe únicamente el alcance de este sprint.

## 1. Contexto del sprint

Este sprint establece la base del sistema web para el gimnasio. Se implementará la estructura inicial del proyecto, la autenticación de usuarios, la gestión de roles y el registro, consulta y modificación de clientes.

El sistema deberá utilizar **React con JavaScript** en el frontend, **Node.js con Express y JavaScript** en el backend y **MySQL local** como base de datos.

El acceso a la información estará controlado de acuerdo con el rol de cada usuario y los permisos deberán validarse en el backend.

La estructura principal del proyecto deberá estar separada en las siguientes carpetas:

* `frontend/`: aplicación web desarrollada con React.
* `backend/`: servidor desarrollado con Node.js y Express, encargado de la API REST, lógica de negocio y acceso a la base de datos.
* `database/`: scripts, migraciones, semillas y archivos relacionados con la base de datos MySQL.

El backend deberá utilizar **ES Modules**. Todos los archivos JavaScript del backend deberán utilizar `import` y `export`. No se deberá utilizar CommonJS mediante `require()` o `module.exports`.

El archivo `backend/package.json` deberá incluir:

```json
{
  "type": "module"
}
```

Los scripts JavaScript utilizados dentro de `database/scripts/` también deberán utilizar ES Modules.

El frontend nunca tendrá acceso directo a MySQL. Toda comunicación con la base de datos se realizará mediante la API REST del backend.

El reconocimiento facial forma parte del sistema completo, pero su implementación funcional corresponde al Sprint 2. En este sprint únicamente se deberá dejar preparada la estructura necesaria para que posteriormente la información facial pueda relacionarse con un cliente.

Durante este sprint **no se instalará ni implementará todavía una librería de reconocimiento facial**. La selección de dicha librería se realizará durante la planificación del Sprint 2.

## 2. Objetivo

Establecer la base funcional del sistema mediante la autenticación de usuarios, la administración de roles y la gestión básica de clientes, dejando preparada la estructura necesaria para integrar posteriormente las funcionalidades de membresías, pagos, reconocimiento facial y control de acceso.

## 3. Historias de usuario del sprint

### US-S1-01 — Inicio de sesión

Como usuario registrado, quiero iniciar sesión con mi correo y contraseña para acceder a las funciones permitidas según mi rol.

### US-S1-02 — Registro de usuarios

Como administrador, quiero registrar nuevos usuarios del sistema para permitir que el personal autorizado pueda utilizar la plataforma.

### US-S1-03 — Asignación de roles

Como administrador, quiero asignar un rol a cada usuario para controlar las funciones que puede utilizar dentro del sistema.

### US-S1-04 — Registro de clientes

Como administrador o recepcionista, quiero registrar nuevos clientes para almacenar su información en el sistema.

### US-S1-05 — Modificación de clientes

Como administrador o recepcionista, quiero modificar la información de un cliente para mantener sus datos actualizados.

### US-S1-06 — Consulta de clientes

Como administrador, recepcionista o entrenador, quiero consultar la información básica de los clientes para realizar mis actividades.

### US-S1-07 — Consulta de información propia

Como cliente, quiero consultar mi propia información para conocer los datos registrados en el sistema.

## 4. Flujo demostrable al cierre del sprint

1. Un usuario registrado accede al sistema.
2. Ingresa su correo y contraseña.
3. El frontend envía las credenciales al backend mediante la API REST.
4. El backend valida las credenciales.
5. La contraseña se verifica utilizando `bcrypt`.
6. El sistema identifica el rol del usuario.
7. Se genera un token JWT para la sesión.
8. El usuario puede acceder únicamente a las funciones permitidas por su rol.
9. El administrador o recepcionista puede registrar un cliente.
10. El backend valida los datos recibidos.
11. La información se almacena en MySQL.
12. Los usuarios autorizados pueden consultar o modificar la información del cliente.
13. Un cliente puede consultar únicamente su propia información.
14. La estructura de la base de datos queda preparada para las funcionalidades de membresías y pagos.
15. La estructura del sistema queda preparada para integrar posteriormente el reconocimiento facial.
16. La implementación del reconocimiento facial se realizará en el Sprint 2.

## 5. Entidades y tablas que toca este sprint

| Tabla             | Operaciones principales      |
| ----------------- | ---------------------------- |
| `usuarios`        | Crear, consultar y modificar |
| `clientes`        | Crear, consultar y modificar |
| `tipos_membresia` | Crear estructura inicial     |
| `membresias`      | Crear estructura inicial     |
| `pagos`           | Crear estructura inicial     |

Las tablas relacionadas con membresías y pagos se prepararán en este sprint para mantener una estructura de base de datos consistente, pero su funcionalidad será implementada en el Sprint 2.

La información relacionada con reconocimiento facial no se procesará ni almacenará funcionalmente en este sprint. La relación entre clientes y datos biométricos será implementada en el Sprint 2.

## 6. Reglas de negocio aplicables

* Las contraseñas deben almacenarse utilizando `bcrypt`.
* La autenticación debe utilizar JWT.
* Los permisos deben validarse en el backend.
* El administrador puede registrar usuarios y asignar roles.
* La gestión de usuarios y roles es exclusiva del administrador.
* El administrador y el recepcionista pueden registrar y modificar clientes.
* El administrador, recepcionista y entrenador pueden consultar la información de clientes de acuerdo con sus permisos.
* El cliente solamente puede consultar su propia información.
* Los usuarios solo pueden acceder a las funciones correspondientes a su rol.
* El frontend no tendrá acceso directo a MySQL.
* El backend será el único componente que accederá directamente a la base de datos.
* Las consultas a MySQL deberán utilizar parámetros para evitar inyecciones SQL.
* Los registros de usuarios y clientes no deberán eliminarse físicamente durante este sprint.
* Las credenciales y datos sensibles deberán manejarse mediante variables de entorno.
* El archivo `.env` no deberá almacenarse en el repositorio.
* Se deberá proporcionar un archivo `.env.example` sin información sensible.
* El backend utilizará ES Modules mediante `import` y `export`.
* No se utilizará CommonJS mediante `require()` o `module.exports`.
* La carpeta destinada a la base de datos será `database/`.
* Las modificaciones de la estructura de la base de datos deberán realizarse mediante scripts SQL versionados.
* La estructura del sistema deberá permitir integrar posteriormente el reconocimiento facial con el cliente correspondiente.
* El reconocimiento facial no será funcional durante el Sprint 1.
* No se instalará una librería de reconocimiento facial durante el Sprint 1.

## 7. Criterios de aceptación

### 7.1 Autenticación

* El usuario registrado puede iniciar sesión con credenciales válidas.
* Las credenciales incorrectas generan un mensaje de error.
* El sistema identifica correctamente el rol del usuario.
* Las rutas protegidas requieren autenticación.
* El backend valida los permisos del usuario.
* Las contraseñas se almacenan mediante hash utilizando `bcrypt`.
* La autenticación utiliza JWT.

### 7.2 Usuarios

* El administrador puede registrar usuarios.
* El administrador puede consultar usuarios.
* El administrador puede modificar usuarios.
* El administrador puede asignar roles.
* Un usuario que no tenga permisos de administrador no puede gestionar usuarios.
* Los roles disponibles corresponden a los definidos en el contexto maestro.

### 7.3 Clientes

* El administrador puede registrar clientes.
* El recepcionista puede registrar clientes.
* El administrador puede modificar clientes.
* El recepcionista puede modificar clientes.
* Los usuarios autorizados pueden consultar clientes.
* El entrenador puede consultar únicamente la información permitida para su rol.
* El cliente solamente puede consultar su propia información.
* Los datos ingresados deben ser validados antes de almacenarse.

### 7.4 Base de datos

* La tabla `usuarios` funciona correctamente.
* La tabla `clientes` funciona correctamente.
* Las tablas `tipos_membresia`, `membresias` y `pagos` quedan creadas con sus relaciones principales.
* Las claves primarias y foráneas se encuentran correctamente definidas.
* La base de datos utiliza MySQL local.
* Las tablas utilizan InnoDB.
* La base de datos utiliza `utf8mb4`.
* La estructura de la base de datos puede reconstruirse mediante scripts SQL versionados.
* El backend es el único componente que accede directamente a MySQL.

### 7.5 Arquitectura

* El proyecto utiliza las carpetas `frontend/`, `backend/` y `database/`.
* El frontend utiliza React y JavaScript.
* El backend utiliza Node.js, Express y JavaScript.
* El backend utiliza ES Modules.
* El backend utiliza `import` y `export`.
* El archivo `backend/package.json` contiene `"type": "module"`.
* No se utiliza `require()` ni `module.exports`.
* La comunicación entre frontend y backend se realiza mediante API REST.
* La lógica de negocio se mantiene separada de las rutas y controladores.

### 7.6 Preparación para reconocimiento facial

* El sistema permite que posteriormente la información facial se relacione con un cliente.
* La arquitectura permite incorporar un servicio de reconocimiento facial.
* No se captura ni procesa el rostro durante este sprint.
* No se realiza comparación facial durante este sprint.
* No se valida el acceso mediante reconocimiento facial durante este sprint.
* No se instala todavía una librería de reconocimiento facial.
* La selección de la librería se realizará durante la planificación del Sprint 2.

## 8. Fuera del alcance del Sprint 1

Las siguientes funcionalidades no se implementarán en este sprint:

* Gestión funcional de membresías.
* Renovación de membresías.
* Control de membresías vencidas o suspendidas.
* Registro funcional de pagos.
* Consulta de adeudos.
* Reconocimiento facial.
* Captura de rostros.
* Comparación de rostros.
* Generación o procesamiento de descriptores faciales.
* Validación de acceso mediante reconocimiento facial.
* Registro funcional de accesos.
* Dashboard.
* Reportes.
* Auditoría funcional.
* Recuperación de contraseña mediante correo electrónico.
* Auto-registro de usuarios.
* Aplicación móvil.
* Administración de múltiples sucursales.
* Nómina.
* Inventario.
* Contabilidad.
* Facturación electrónica.
* Procesamiento directo de pagos mediante bancos o plataformas externas.

El reconocimiento facial será desarrollado en el Sprint 2, incluyendo la selección de la librería adecuada, captura mediante cámara, procesamiento de la información facial, identificación del cliente y validación del acceso.

## 9. Decisiones pendientes para `/speckit.clarify`

Las siguientes decisiones deberán aclararse durante el proceso de especificación y planificación:

* Librería de reconocimiento facial que se utilizará en el Sprint 2.
* Compatibilidad de la librería seleccionada con JavaScript y Node.js.
* Compatibilidad con la captura mediante cámara.
* Forma de almacenamiento de los datos o descriptores faciales.
* Forma de proteger la información biométrica.
* Umbral de coincidencia facial.
* Condiciones mínimas de iluminación.
* Manejo de errores cuando el rostro no pueda ser reconocido.
* Política para actualizar o volver a registrar la información facial.
* Métodos de pago que serán utilizados en el Sprint 2.
* Política para membresías vencidas, suspendidas o canceladas.
* Manejo de pagos parciales, si se requieren.
* Configuración específica de sesiones y expiración de tokens.

## 10. Restricciones técnicas heredadas

Este sprint deberá respetar las restricciones establecidas en `docs/reglas.md` y `docs/project-context.md`.

### Frontend

* React.
* JavaScript.
* Comunicación con el backend mediante API REST.
* No tendrá conexión directa con MySQL.

### Backend

* Node.js.
* Express.
* JavaScript.
* ES Modules.
* Uso obligatorio de `import` y `export`.
* `"type": "module"` en `package.json`.
* No utilizar CommonJS.
* API REST.
* JWT para autenticación.
* `bcrypt` para protección de contraseñas.
* Validación de permisos en backend.

### Base de datos

* MySQL local.
* Motor InnoDB.
* Codificación `utf8mb4`.
* Consultas parametrizadas.
* Claves primarias y foráneas.
* Integridad referencial.
* Scripts SQL versionados.
* Carpeta oficial: `database/`.

### Seguridad

* Las credenciales deberán manejarse mediante variables de entorno.
* `.env` deberá estar incluido en `.gitignore`.
* Se deberá proporcionar `.env.example` sin secretos.
* No se deberán almacenar contraseñas en texto plano.
* Los permisos deberán validarse en el backend.
* Los errores mostrados al usuario no deberán revelar información interna del servidor.
* Los datos biométricos deberán protegerse cuando sean implementados en el Sprint 2.

### Reconocimiento facial

* La funcionalidad pertenece al sistema completo, pero será implementada en Sprint 2.
* La librería facial no se instalará durante Sprint 1.
* La librería deberá seleccionarse y justificarse antes de su implementación.
* La implementación deberá integrarse mediante el backend y respetar las reglas de seguridad del proyecto.

### Estructura del proyecto

La estructura esperada al finalizar este sprint será:

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

Los archivos JavaScript utilizados en `backend/` deberán utilizar ES Modules. Los scripts JavaScript de `database/scripts/` deberán seguir la misma convención de módulos cuando corresponda.

No deberán crearse carpetas alternativas como `client/`, `server/` o `dataBase/`.

El Sprint 2 dependerá de la base de usuarios y clientes creada durante este sprint y utilizará la estructura preparada para integrar membresías, pagos, reconocimiento facial y control de acceso.
