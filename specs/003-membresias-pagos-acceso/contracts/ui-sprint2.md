# Contratos de interfaz: Sprint 2

Se reutiliza la configuración de menú, el `Layout` y los componentes de `frontend/src/components/ui/` del rediseño (`specs/002-interfaz-menu-lateral/contracts/ui-contracts.md`).

## Menú (`frontend/src/config/menu.js`)

Nuevo bloque `membresias-pagos` ("Membresías y pagos") entre "Operación" y "Administración". Entradas nuevas:

| id | Etiqueta | Ruta | Bloque | Ícono (lucide-react) | Roles |
|---|---|---|---|---|---|
| `dashboard` | Dashboard | `/dashboard` | general | `LayoutDashboard` | administrador |
| `accesos` | Accesos | `/accesos` | operacion | `DoorOpen` | administrador, recepcionista, entrenador |
| `estacion` | Estación de acceso | `/estacion` | operacion | `ScanFace` | administrador, recepcionista |
| `tipos-membresia` | Tipos de membresía | `/tipos-membresia` | membresias-pagos | `Tags` | administrador, recepcionista |
| `pagos` | Pagos | `/pagos` | membresias-pagos | `Wallet` | administrador, recepcionista |
| `adeudos` | Adeudos | `/adeudos` | membresias-pagos | `ReceiptText` | administrador, recepcionista |

`seccionDeRuta` resuelve el título del encabezado también para subrutas. El orden dentro del bloque "General" es Inicio, Mi información, Dashboard.

## Rutas (`frontend/src/App.jsx`)

| Ruta | Dentro del `Layout` | Roles | Pantalla |
|---|---|---|---|
| `/dashboard` | sí | administrador | `Dashboard` |
| `/tipos-membresia` | sí | administrador, recepcionista (solo consulta) | `TiposMembresia` (+ formulario en diálogo para el administrador) |
| `/pagos` | sí | administrador, recepcionista | `Pagos` (+ diálogo "Registrar pago") |
| `/adeudos` | sí | administrador, recepcionista | `Adeudos` |
| `/accesos` | sí | administrador, recepcionista, entrenador | `Accesos` |
| `/estacion` | **no** (pantalla completa) | administrador, recepcionista | `EstacionAcceso` |
| `/clientes/:id` | sí | existente | se amplía con el panel de membresía y el de rostro |

Todas usan `RutaProtegida` con los roles indicados ("Sin permiso" para el resto); la validación real sigue en el servidor.

## Módulo de reconocimiento facial (`frontend/src/lib/reconocimientoFacial.js`)

Única puerta de entrada a `@vladmandic/face-api`; el resto de la aplicación no la importa. En las pruebas se sustituye por un doble.

| Función | Descripción |
|---|---|
| `cargarModelos()` | Importa la biblioteca con `import()` y carga los tres modelos desde `/models` (una sola vez). Lanza un error claro si fallan. |
| `analizarFotograma(video)` | Devuelve `{ estado, descriptor?, confianza?, tamano? }` con `estado` ∈ `sin_rostro`, `varios`, `lejos`, `baja_confianza`, `ok`. Solo con `ok` incluye el descriptor (`Float32Array` de 128). |
| `capturarMuestras(video, { cantidad: 5, intervaloMs: 300 })` | Registro de rostro: reúne muestras válidas, descarta la captura si discrepan más de 0,4 y devuelve el descriptor promedio como arreglo de 128 números. |

## Hook y componente de cámara

- `useCamara()` (`frontend/src/hooks/useCamara.js`): pide `getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })`, devuelve `{ videoRef, estado, error, iniciar, detener }` con `estado` ∈ `inactiva`, `solicitando`, `activa`, `denegada`, `sin_camara`, `ocupada`; detiene todas las pistas al desmontar. Nunca captura imágenes: el vídeo solo se muestra y se analiza.
- `CamaraFacial` (`frontend/src/components/CamaraFacial.jsx`): `<video>` con marco de escáner (esquinas verdes), mensajes de ayuda (poca luz, acércate, un rostro a la vez) y estados de error con instrucciones para habilitar el permiso.

## Pantallas y componentes

| Elemento | Contrato |
|---|---|
| `EstacionAcceso` | Estados: `cargando_modelos` → `espera` → `analizando` → `resultado` (5 s, verde/rojo con nombre, plan, días y motivo) → `espera`; `pausa` de 30 s tras **3** "Rostro no reconocido" seguidos con "No te reconocemos. Pide ayuda en recepción"; enfriamiento de 10 s para la misma persona; botón "Salir" y botón de pantalla completa; si la sesión vence, pide iniciar sesión. Solo envía `POST /accesos/identificar` con el descriptor. |
| `RegistrarRostro` (diálogo en el detalle del cliente) | Casilla de consentimiento obligatoria; vista de cámara; captura de 5 muestras; envía `POST /clientes/:id/rostro`; indicaciones si no hay un solo rostro claro. |
| `PanelMembresia` (detalle del cliente) | Muestra `actual`, `proxima` e `historial`; acciones según rol: asignar (con opción "Registrar el pago ahora"), renovar, registrar pago, y (administrador) suspender, reactivar, cancelar con `ConfirmDialog`. |
| `PanelRostro` (detalle del cliente) | "Rostro registrado el …" o "Sin rostro registrado"; registrar o reemplazar; el administrador además desactiva y reactiva con confirmación. Nunca muestra datos biométricos. |
| Tarjetas del Inicio del cliente | `MiMembresia` (barra de progreso verde / amarilla ≤ 5 días / roja vencida; "Pendiente de pago" con el monto), `AccesoFacial`, `MisVisitas`, `MisPagos`; se activan en `config/tarjetasCliente.js`. |
| Indicadores del Inicio | En `config/indicadores.js`: `accesos-hoy` y `membresias-por-vencer` pasan a `disponible: true`; se agrega `clientes-entraron-hoy` (entrenador) y la lista de los últimos que entraron. |
