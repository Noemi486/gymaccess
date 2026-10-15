# Data Model: Membresías, pagos, reconocimiento facial y control de acceso (Sprint 2)

**No hay migraciones ni tablas nuevas** (decisión del equipo, FR-048). Todo se guarda en las tablas que ya crean `database/migrations/01_esquema_sprint1.sql` y `02_esquema_sprint2.sql`. El usuario `gymaccess_app` solo tiene `SELECT`, `INSERT` y `UPDATE`: las bajas son lógicas y pagos, accesos y auditoría nunca se modifican.

## Uso de cada tabla

### `tipos_membresia` (crear, consultar, modificar)

| Campo | Regla en la API |
|---|---|
| `nombre` | 1–80 caracteres, único (la base lo exige; el servicio responde 409 con el campo `nombre`) |
| `descripcion` | opcional, hasta 255 |
| `duracion` | entero de **1 a 3650** días |
| `precio` | **mayor a 0**, hasta 2 decimales, máximo 99 999 999,99 (la base admite 0; la API no, ver research R1) |
| `estado` | `activo` / `inactivo` (baja lógica; un plan inactivo no se puede elegir para asignar o renovar) |

### `membresias` (crear, consultar, modificar el estado guardado)

| Campo | Uso |
|---|---|
| `id_cliente` | cliente activo y existente |
| `id_tipo_membresia` | plan activo con precio > 0 |
| `fecha_inicio`, `fecha_fin` | `fecha_fin = fecha_inicio + duracion − 1 día` (el día de inicio cuenta como día 1); `fecha_fin ≥ fecha_inicio` (lo exige la base) |
| `estado` (guardado) | solo se escribe `activa` (alta), `suspendida` y `cancelada`. **Nunca se escribe `vencida`**: el vencimiento se deduce de las fechas (FR-012) |

### `pagos` (crear y consultar; inmutables)

`id_cliente` + `id_membresia` (siempre ambos, RN-05), `monto` (igual al precio del plan en ese momento, en centavos), `metodo_pago` (`efectivo` / `tarjeta` / `transferencia`), `fecha_pago` (la pone la base), `estado` (`registrado`; nunca se cancela en este sprint) e `id_usuario` (quien lo registró, obligatorio en la API). Una membresía tiene **a lo más un pago `registrado`**: se garantiza en el servicio bloqueando la fila de la membresía (`SELECT … FOR UPDATE`) dentro de la transacción.

### `rostros` (crear, consultar, cambiar estado)

`id_cliente`, `descriptor_facial` (BLOB cifrado: ver abajo), `fecha_registro`, `estado`. A lo más un rostro `activo` por cliente (servicio + transacción con bloqueo del cliente).

**Formato de `descriptor_facial`** (541 bytes):

| Bytes | Contenido |
|---|---|
| 1 | versión del formato (`0x01`) |
| 12 | IV aleatorio (AES-GCM) |
| 16 | etiqueta de autenticación |
| 512 | descriptor: 128 `float32` little-endian, cifrado con AES-256-GCM; datos autenticados = `rostro:<id_cliente>` |

El descriptor descifrado solo existe en memoria del servidor durante la comparación; nunca se escribe en registros ni se devuelve.

### `accesos` (crear y consultar; inmutables)

Cada intento: `id_cliente` (NULL si no se reconoció), `fecha` y `hora` (valores por defecto de la base), `tipo` (siempre `entrada`), `resultado`, `motivo_rechazo`. Las restricciones de la base se respetan: autorizado ⇒ cliente identificado; rechazado ⇒ motivo no vacío.

**Motivos de rechazo** (texto exacto guardado y mostrado): `Rostro no reconocido`, `Cliente dado de baja`, `Sin membresía`, `Pago pendiente`, `Membresía vencida`, `Membresía suspendida`, `Membresía cancelada`.

### `auditoria` (crear)

`id_usuario`, `accion` (≤ 100), `modulo` (≤ 50), `resultado` (`exito` / `error`), `descripcion` (≤ 500, sin datos sensibles).

| Módulo | Acciones (`accion`) |
|---|---|
| `tipos_membresia` | `crear`, `modificar`, `desactivar`, `activar` |
| `membresias` | `asignar`, `renovar`, `suspender`, `reactivar`, `cancelar` |
| `pagos` | `registrar` |
| `rostros` | `registrar`, `reemplazar`, `desactivar`, `reactivar` |

Los intentos de acceso **no** van a auditoría: su registro es la tabla `accesos`.

## Estado efectivo de una membresía (derivado, no se guarda)

```text
cancelada ─────────────────────────────▶ fin (no se reactiva ni se paga)

suspendida ◀──suspender── (vigente | pendiente_de_pago | proxima) ──reactivar──▶ vuelve a su estado efectivo

pendiente_de_pago ──registrar pago──▶ vigente  (o proxima, si empieza después de hoy)
        │
        └── fecha_fin < hoy ──▶ vencida (ya no se puede pagar; se asigna una nueva)

vigente ── fecha_fin < hoy ──▶ vencida
proxima ── llega fecha_inicio ──▶ vigente
```

| Estado efectivo | Cómo se obtiene (ver la tabla de reglas en research R1) | ¿Da acceso? |
|---|---|---|
| `vigente` | guardada `activa`, con pago, `fecha_inicio ≤ hoy ≤ fecha_fin` | **Sí** |
| `proxima` | guardada `activa`, con pago, `fecha_inicio > hoy` (renovación futura) | No (todavía) |
| `pendiente_de_pago` | guardada `activa`, sin pago, `fecha_fin ≥ hoy` | No (**Pago pendiente** si cubre hoy) |
| `vencida` | `fecha_fin < hoy` (si no está cancelada ni suspendida) | No |
| `suspendida` | guardada `suspendida` | No |
| `cancelada` | guardada `cancelada` | No |

Para decidir el acceso se toma la membresía **en curso** del cliente (la que cubre hoy); si ninguna la cubre se toma la más reciente.

## Reglas de integridad y dónde se hacen cumplir

| Regla | Dónde |
|---|---|
| Cliente existente y activo para asignar membresía o registrar rostro | servicio (validación + FK en la base) |
| A lo más una membresía en curso y una renovación futura por cliente | servicio, en transacción con bloqueo de la fila del cliente |
| Un pago por membresía; monto = precio vigente; no pagar canceladas ni vencidas | servicio, en transacción con bloqueo de la membresía |
| Un rostro activo por cliente | servicio, en transacción con bloqueo del cliente |
| Nada se borra | el usuario de la base no tiene `DELETE`; las rutas no existen |
| Descriptor nunca expuesto | serializadores de salida y prueba automática que revisa todas las respuestas |
| Accesos rechazados con motivo; autorizados con cliente | restricciones `CHECK` de la base + servicio |

## Cálculos derivados

- **Adeudo** de una membresía en estado `pendiente_de_pago` = `tipos_membresia.precio` actual; en cualquier otro estado, 0.
- **Días restantes** = `fecha_fin − hoy` (0 el último día; negativo = vencida hace N días).
- **Por vencer** = `vigente` con días restantes entre 0 y 5.
- **Categorías de clientes del Dashboard** (excluyentes, FR-040): *vigente* (tiene una `vigente`), *vencida* (no tiene vigente y su última membresía pagada ya terminó), *sin membresía* (el resto). Las pendientes de pago no cuentan como vigentes.
- **Ingresos del periodo** = suma de `pagos.monto` con estado `registrado` y `fecha_pago` entre el inicio del primer día y el fin del último.
- **Dinero**: los `DECIMAL` de MySQL llegan como texto; se convierten a **centavos enteros** para comparar y sumar, y se devuelven como número con dos decimales.
