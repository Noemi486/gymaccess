# Contratos de la API: Sprint 2

Todas las rutas cuelgan de `/api`, exigen `Authorization: Bearer <JWT>` (salvo `POST /auth/login`, ya existente) y responden JSON. Errores con la forma ya establecida: `{ "error": { "code", "message", "details": [{ "field", "message" }] } }` con los códigos 400 (validación), 401, 403, 404, 409 (regla de negocio o duplicado), 423 y 429.

**Ninguna respuesta incluye el descriptor facial ni `descriptor_facial`.** Listas paginadas: `{ data, page, limit, total }` (20 por página, máximo 100). Fechas `YYYY-MM-DD`; fechas y horas con hora, ISO 8601. Dinero: número con dos decimales.

Roles: **A** administrador · **R** recepcionista · **E** entrenador · **C** cliente.

## Objeto `Membresia`

```jsonc
{
  "id_membresia": 12,
  "id_cliente": 7,
  "tipo": { "id_tipo_membresia": 2, "nombre": "Plan Mensual", "duracion": 30 },
  "fecha_inicio": "2026-10-14",
  "fecha_fin": "2026-11-12",
  "estado": "vigente",            // vigente | proxima | pendiente_de_pago | vencida | suspendida | cancelada
  "dias_restantes": 29,           // negativo si venció
  "por_vencer": false,            // vigente con 0–5 días
  "precio": 450.00,               // pagos.monto si está pagada; precio vigente del plan si está pendiente
  "adeudo": 0,                    // = precio si pendiente_de_pago; 0 en los demás casos
  "pago": { "id_pago": 31, "fecha_pago": "2026-10-14T10:02:11", "metodo_pago": "efectivo", "monto": 450.00 }   // null si no hay pago
}
```

## Tipos de membresía — `/api/tipos-membresia`

| Método y ruta | Roles | Cuerpo / parámetros | Respuesta |
|---|---|---|---|
| `GET /` | A, R | `estado`, `q`, `page`, `limit` (R solo recibe planes `activo`, sin importar `estado`) | lista de `{ id_tipo_membresia, nombre, descripcion, duracion, precio, estado }` |
| `GET /:id` | A, R | — | un plan con `membresias_pendientes_de_pago` (cantidad de membresías de ese plan sin pago registrado que no han vencido ni se cancelaron; la usa la interfaz para advertir antes de cambiar el precio). El recepcionista recibe 404 si el plan está inactivo |
| `POST /` | A | `nombre` (1–80), `descripcion?` (≤255), `duracion` (1–3650), `precio` (> 0, ≤ 2 decimales) | 201 plan; 409 si el nombre existe |
| `PATCH /:id` | A | cualquiera de los campos anteriores (al menos uno) | plan; no cambia membresías ya pagadas |
| `PATCH /:id/estado` | A | `{ "estado": "activo" \| "inactivo" }` | plan |

No existe `DELETE`.

## Membresías

| Método y ruta | Roles | Cuerpo / parámetros | Respuesta |
|---|---|---|---|
| `GET /clientes/:id/membresias` | A, R | — | `{ "actual": Membresia \| null, "proxima": Membresia \| null, "historial": [Membresia] }` (historial: las últimas 50) |
| `POST /clientes/:id/membresias` | A, R | `id_tipo_membresia`, `fecha_inicio?` (hoy por defecto; no anterior a hoy ni posterior a 60 días), `pago?: { metodo_pago, monto }` | 201 `{ membresia, pago \| null }`. Con `pago` se crean membresía y pago en una transacción |
| `POST /membresias/:id/renovar` | A, R | `fecha_inicio?`, `pago?` (igual que arriba) | 201 `{ membresia, pago \| null }` |
| `PATCH /membresias/:id/estado` | A | `{ "accion": "suspender" \| "reactivar" \| "cancelar" }` | `Membresia` |

Reglas y errores (409 salvo que se indique):
- Cliente inactivo o inexistente (404) · plan inactivo o con precio no válido · el cliente ya tiene una membresía **en curso** (vigente o pendiente de pago) al asignar · ya tiene una **renovación futura** o su membresía en curso está **pendiente de pago** al renovar.
- Renovación: si la membresía vigente aún no vence, `fecha_inicio` = día siguiente a su `fecha_fin` (no se acepta otra); si ya venció, la fecha indicada (hoy por defecto).
- `cancelar` no se puede deshacer; `reactivar` solo aplica a suspendidas.

## Pagos — `/api/pagos`

| Método y ruta | Roles | Cuerpo / parámetros | Respuesta |
|---|---|---|---|
| `GET /` | A, R | `desde`, `hasta`, `metodo_pago`, `q` (cliente), `page`, `limit` | `{ data: [{ id_pago, fecha_pago, cliente: { id_cliente, nombre, apellido }, membresia: { id_membresia, plan }, monto, metodo_pago, registrado_por }], page, limit, total, total_monto }` |
| `POST /` | A, R | `id_membresia`, `metodo_pago` (`efectivo` \| `tarjeta` \| `transferencia`), `monto` | 201 pago + `membresia` actualizada |

Errores: `monto` distinto del precio vigente del plan → 400 con `details: [{ field: "monto", message: "El pago debe ser por el monto completo: $450.00." }]`; membresía ya pagada, cancelada o vencida → 409; membresía inexistente → 404. No existen `PUT`, `PATCH` ni `DELETE`.

## Adeudos — `GET /api/adeudos` (A, R)

Parámetros: `q`, `page`, `limit`. Respuesta: `{ data: [{ id_membresia, cliente: { id_cliente, nombre, apellido }, plan, adeudo, fecha_inicio, fecha_fin }], page, limit, total, total_adeudo }`, con la `fecha_inicio` más antigua primero. Solo membresías en estado `pendiente_de_pago`.

## Rostros

| Método y ruta | Roles | Cuerpo | Respuesta |
|---|---|---|---|
| `GET /clientes/:id/rostro` | A, R | — | `{ "registrado": true, "activo": { id_rostro, fecha_registro } \| null, "historial": [{ id_rostro, fecha_registro, estado }] }` |
| `POST /clientes/:id/rostro` | A, R | `descriptor` (arreglo de **128 números** finitos, cada uno entre −5 y 5, no todos cero), `consentimiento: true` | 201 `{ id_rostro, fecha_registro, estado }`; el rostro activo anterior pasa a `inactivo` |
| `PATCH /rostros/:id/estado` | A | `{ "estado": "activo" \| "inactivo" }` | `{ id_rostro, id_cliente, fecha_registro, estado }`; activar uno desactiva el que estuviera activo |

Errores: cliente inactivo o inexistente; `consentimiento` ausente o falso (400); descriptor inválido (400, sin guardar nada).

## Accesos

| Método y ruta | Roles | Cuerpo / parámetros | Respuesta |
|---|---|---|---|
| `POST /accesos/identificar` | A, R | `descriptor` (igual que arriba) | 200 siempre que la petición sea válida, aunque se rechace el acceso (ver abajo); 429 si el usuario supera 30 intentos por minuto |
| `GET /accesos` | A, R, E | `desde`, `hasta`, `resultado`, `q`, `page`, `limit` | lista de `{ id_acceso, fecha, hora, tipo, resultado, motivo_rechazo, cliente: { id_cliente, nombre, apellido } \| null }`. Para E se omiten `tipo` y `motivo_rechazo` |

Respuesta de `identificar` (cada llamada válida registra **un** acceso):

```jsonc
// autorizado
{ "resultado": "autorizado", "id_acceso": 410,
  "cliente": { "id_cliente": 7, "nombre": "Min", "apellido": "Cabrera" },
  "membresia": { "plan": "Plan Mensual", "fecha_fin": "2026-11-12", "dias_restantes": 29 } }

// rechazado (con cliente identificado)
{ "resultado": "rechazado", "id_acceso": 411, "motivo": "Pago pendiente",
  "cliente": { "id_cliente": 9, "nombre": "Luis", "apellido": "Soto" } }

// rechazado (sin identificar): no incluye cliente
{ "resultado": "rechazado", "id_acceso": 412, "motivo": "Rostro no reconocido" }
```

Orden de decisión: coincidencia clara con un solo cliente (distancia euclidiana ≤ 0,5) → cliente activo → membresía en curso → pagada → vigente; el primer fallo fija el motivo (ver data-model).

## Dashboard — `GET /api/dashboard` (A)

Parámetros: `periodo` = `hoy` (predeterminado) \| `semana` \| `mes` \| `rango`; con `rango`: `desde` y `hasta` (válidos: `desde ≤ hasta`, sin fechas futuras, máximo 366 días; si no, 400).

```jsonc
{
  "periodo": { "tipo": "semana", "desde": "2026-10-12", "hasta": "2026-10-14" },
  "estado_actual": { "clientes_activos": 40, "con_membresia_vigente": 31, "con_membresia_vencida": 6, "con_membresia_por_vencer": 4 },
  "periodo_datos": { "ingresos": 5400.00, "accesos_autorizados": 212, "accesos_rechazados": 9 },
  "accesos_recientes": [ /* los 10 últimos del periodo, igual que GET /accesos */ ]
}
```

`con_membresia_por_vencer` es un subconjunto de `con_membresia_vigente`.

## Resumen del Inicio — ampliación de `GET /api/resumen` (A, R, E)

Se añaden claves (las existentes no cambian):

| Rol | Claves nuevas |
|---|---|
| A, R | `accesos: { hoy }` (accesos autorizados de hoy) y `membresias: { por_vencer }` |
| E | `accesos: { clientes_hoy, ultimos: [{ id_cliente, nombre, apellido, hora }] }` (clientes distintos con acceso autorizado hoy; proyección básica) |

## Resumen del cliente — `GET /api/clientes/me/resumen` (C)

Usa solo el `id_cliente` de la sesión. Va **antes** de `GET /clientes/:id` para que `me` no se lea como un id.

```jsonc
{
  "membresia": Membresia | null,                       // la en curso; si no hay, la pendiente o la más reciente
  "rostro": { "registrado": true, "fecha_registro": "2026-10-14T09:00:00" },
  "visitas": [ { "fecha": "2026-10-14", "hora": "07:15:02", "resultado": "autorizado", "motivo_rechazo": null } ],   // últimas 5
  "pagos": [ { "fecha_pago": "2026-10-14T10:02:11", "monto": 450.00, "metodo_pago": "efectivo", "plan": "Plan Mensual" } ],  // últimos 5
  "adeudo": { "monto": 450.00, "plan": "Plan Mensual" } | null
}
```

## Matriz de permisos (resumen)

| Recurso | A | R | E | C |
|---|---|---|---|---|
| Tipos de membresía: leer / escribir | sí / sí | solo activos / no | no | no |
| Membresías de un cliente: leer / asignar y renovar / suspender, reactivar, cancelar | sí / sí / sí | sí / sí / no | no | no |
| Pagos y adeudos: leer / registrar | sí / sí | sí / sí | no | no |
| Rostro: leer estado / registrar / desactivar y reactivar | sí / sí / sí | sí / sí / no | no | no |
| Identificar (estación) | sí | sí | no | no |
| Accesos: leer | completo | completo | básico | no (los suyos, en su resumen) |
| Dashboard | sí | no | no | no |
| Resumen propio del cliente | no | no | no | sí |
