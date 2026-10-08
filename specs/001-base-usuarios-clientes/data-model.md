# Modelo de datos: Base del sistema, usuarios y clientes

**Feature**: `001-base-usuarios-clientes` | **Fuente de verdad**: `database/migrations/01_esquema_sprint1.sql`

**No se crean tablas ni se modifica ninguna columna.** Este documento describe cómo el backend
usa las tablas existentes. Conexión con el usuario `gymaccess_app` (solo `SELECT`, `INSERT` y
`UPDATE`; sin `DELETE`).

## Tablas usadas en este sprint

### `clientes`

| Columna | Tipo | Regla en el esquema | Regla adicional del backend |
|---------|------|---------------------|-----------------------------|
| `id_cliente` | INT UNSIGNED, PK, AUTO_INCREMENT | | |
| `nombre` | VARCHAR(80) | NOT NULL, no vacío tras `TRIM` | Obligatorio, se recorta, máx. 80 |
| `apellido` | VARCHAR(80) | NOT NULL, no vacío tras `TRIM` | Obligatorio, se recorta, máx. 80 |
| `correo` | VARCHAR(150) | NULL, UNIQUE | Opcional; `""` o espacios → `NULL`; minúsculas; formato válido; máx. 150 |
| `telefono` | VARCHAR(20) | NOT NULL, no vacío tras `TRIM` | Obligatorio, máx. 20; solo dígitos, espacios, `+`, `-`, `(`, `)` |
| `direccion` | VARCHAR(255) | NULL | Opcional, máx. 255 |
| `fecha_registro` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Solo lectura (nunca se modifica) |
| `estado` | ENUM('activo','inactivo') | DEFAULT 'activo' | Solo el administrador lo cambia |

Índice de búsqueda existente: `idx_clientes_nombre (apellido, nombre)`.

### `usuarios`

| Columna | Tipo | Regla en el esquema | Regla adicional del backend |
|---------|------|---------------------|-----------------------------|
| `id_usuario` | INT UNSIGNED, PK, AUTO_INCREMENT | | |
| `nombre` | VARCHAR(120) | NOT NULL | Obligatorio, máx. 120 |
| `correo` | VARCHAR(150) | NOT NULL, UNIQUE | Minúsculas; formato válido |
| `password` | VARCHAR(100) | NOT NULL | Solo hash bcrypt; nunca se devuelve |
| `rol` | ENUM('administrador','recepcionista','entrenador','cliente') | NOT NULL | Uno de los cuatro |
| `estado` | ENUM('activo','inactivo') | DEFAULT 'activo' | |
| `id_cliente` | INT UNSIGNED, FK → `clientes` | UNIQUE; `CHECK`: obligatorio si rol = cliente y nulo en los demás roles | Para rol cliente: el cliente debe existir, tener correo y coincidir con el correo de la cuenta |
| `fecha_registro` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Solo lectura |

### Tablas presentes pero sin uso funcional en este sprint

`tipos_membresia`, `membresias`, `pagos`, `rostros`, `accesos`, `auditoria`: el backend no las
consulta ni las modifica (FR-022).

## Relaciones

```text
clientes 1 ──── 0..1 usuarios      (usuarios.id_cliente, única; solo para rol cliente)
```

## Política de contraseñas (FR-007a)

8 a 72 caracteres, con al menos una letra y un número. Se valida antes de calcular el hash.

## Estados y transiciones

| Entidad | Transición | Quién | Efecto |
|---------|------------|-------|--------|
| Usuario | activo ⇄ inactivo | Administrador | Inactivo no puede iniciar sesión ni usar una sesión ya abierta. Prohibido si deja al sistema sin administradores activos (FR-012) |
| Usuario | cambio de rol | Administrador | Efecto inmediato. Prohibido si quita al último administrador activo. No se permite cambiar hacia o desde el rol cliente (el vínculo con un cliente se fija al crear la cuenta) |
| Cliente | activo ⇄ inactivo | Solo administrador | Baja lógica; el registro se conserva. Mientras esté inactivo, su cuenta de acceso (si la tiene) no puede iniciar sesión ni usar una sesión abierta (FR-003b); al reactivarlo la recupera. Se calcula al leer el usuario con un `LEFT JOIN` a `clientes` (`estado_cliente`) |

No existe transición de borrado.

## Estado en memoria (fuera de la base de datos)

**Intentos de inicio de sesión** (FR-003a): `Map<correo_normalizado, { fallos, bloqueadoHasta }>`.

- 5 fallos seguidos fijan `bloqueadoHasta = ahora + 15 min`.
- Un inicio de sesión exitoso borra la entrada.
- Una entrada vencida se limpia al consultarla.
- Se pierde al reiniciar el servidor (limitación documentada en `research.md`, D4).

## Vista de datos por rol (clientes)

| Campo | Administrador | Recepcionista | Entrenador | Cliente (solo el propio) |
|-------|:---:|:---:|:---:|:---:|
| `id_cliente` | ✔ | ✔ | ✔ | ✔ |
| `nombre`, `apellido` | ✔ | ✔ | ✔ | ✔ |
| `estado`, `fecha_registro` | ✔ | ✔ | ✔ | ✔ |
| `telefono`, `correo`, `direccion` | ✔ | ✔ | ✘ | ✔ |

El filtrado se hace en el servicio del backend, no en la interfaz.
