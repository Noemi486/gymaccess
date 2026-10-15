# Research: Membresías, pagos, reconocimiento facial y control de acceso (Sprint 2)

Decisiones técnicas del plan. Las marcadas con **[Equipo]** las tomó el equipo el 2026-10-14; el resto las propone este plan. No quedan `NEEDS CLARIFICATION`.

## R1. Estado "pendiente de pago" derivado, sin columnas ni migraciones **[Equipo]**

- **Decision**: No se agrega ninguna columna ni migración. Una membresía **sin un pago `registrado`** está *pendiente de pago*. El precio cobrado queda en `pagos.monto`; el precio de una membresía pendiente es el del plan (`tipos_membresia.precio`) en el momento de cobrar.
- **Rationale**: Mantiene el esquema ya creado y evita tocar la base real. El pago es un hecho que la base ya registra, así que derivar el estado evita que el dato "pagada" se desincronice.
- **Consecuencias (a revisar con el equipo)**:
  1. El adeudo de una membresía **pendiente** sigue el precio actual del plan; si el administrador cambia el precio, cambian esos adeudos. Las membresías **ya pagadas** no se afectan (su precio está en `pagos.monto`). El spec decía que el adeudo no cambiaba: se ajusta (ver "Ajustes al spec").
  2. Un plan con precio `$0` no puede registrar pago (`pagos.monto > 0` en la base), así que no se podría distinguir "gratis" de "pendiente" sin una columna. Por eso **la API exige precio > 0** en los planes (más estricta que la base, que acepta ≥ 0) y no se pueden asignar planes con precio 0.
  3. El adeudo mostrado al pagar se valida contra el precio vigente del plan en ese instante; si cambió entre que se abrió el formulario y se envió, el servidor responde 400 con el monto actual.
- **Alternatives considered**: columna `precio_acordado` en `membresias` (conserva el precio al asignar, pero exige migración: descartada por decisión del equipo); nuevo valor `pendiente` en el `ENUM` de estado (migración: descartada); tabla de adeudos (tabla nueva sin justificación suficiente).

### Estado efectivo de una membresía (función única, `backend/src/utils/membresia.js`)

Entradas: `estado` guardado, `fecha_inicio`, `fecha_fin`, `tiene_pago` (existe un pago `registrado`) y `hoy` (fecha de la base de datos).

| Orden | Condición | Estado efectivo |
|---|---|---|
| 1 | `estado = cancelada` | `cancelada` |
| 2 | `estado = suspendida` | `suspendida` |
| 3 | `fecha_fin < hoy` | `vencida` |
| 4 | no `tiene_pago` | `pendiente_de_pago` |
| 5 | `fecha_inicio > hoy` | `proxima` (renovación futura ya pagada) |
| 6 | en cualquier otro caso | `vigente` |

"Por vencer" = `vigente` con `fecha_fin - hoy ≤ 5` días. "En curso" = la que cubre hoy (`vigente` o `pendiente_de_pago` con `fecha_inicio ≤ hoy ≤ fecha_fin`). La fecha `hoy` sale de la base de datos (`CURDATE()`), no del reloj de Node, para que consultas SQL y reglas usen el mismo día.

## R2. Biblioteca de reconocimiento facial: `@vladmandic/face-api` **[Equipo]**

- **Decision**: `@vladmandic/face-api` **1.7.15** en el frontend. Verificado en el registro de npm: licencia **MIT**, sin dependencias (`dependencies` vacío), compilación ESM para navegador de 1.3 MB que ya incluye TensorFlow.js (`dist/face-api.esm.js`), último lanzamiento el 2025-02-05.
- **Rationale**: Compatible con React/Vite (módulo ESM puro), funciona 100 % local en el navegador, no requiere servicios externos ni compilar módulos nativos (a diferencia de opciones para Node), licencia permisiva y API sencilla para obtener el descriptor de 128 valores.
- **Alternatives considered**: `face-api.js` original (sin mantenimiento desde 2020); `@tensorflow-models/face-landmarks-detection` (no produce descriptores de identificación); procesamiento en el backend con `@vladmandic/face-api` + `canvas`/tfjs-node (obligaría a enviar fotos al servidor y a compilar dependencias nativas: contradice "nunca se envían fotos"); servicios en la nube (prohibidos: funcionamiento local).
- **Riesgo conocido**: el último lanzamiento es de febrero de 2025 (proyecto en modo de mantenimiento). Se mitiga fijando la versión exacta (`1.7.15`, sin `^`), aislándola tras un único módulo (`frontend/src/lib/reconocimientoFacial.js`) y copiando los modelos al repositorio, de modo que un cambio de biblioteca no toca el resto de la aplicación.

### Modelos (servidos localmente, sin internet)

Se copian de la carpeta `model/` del paquete a `frontend/public/models/`, junto con un `LEEME.md` (origen, versión, licencia MIT y huellas SHA-256):

| Modelo | Archivo | Tamaño | Uso |
|---|---|---|---|
| Detector de rostros pequeño | `tiny_face_detector_model-*` | 193 KB | Detecta el rostro en cada fotograma (rápido en laptop) |
| Puntos faciales (68) | `face_landmark_68_model-*` | 357 KB | Alinea el rostro antes de describirlo |
| Reconocimiento | `face_recognition_model-*` | 6,4 MB | Genera el descriptor de 128 valores |

Total ≈ 7 MB, cargados una sola vez al abrir la estación o el registro de rostro (el navegador los guarda en caché). No se copian los modelos de edad, género ni expresiones (no se usan: evita inferir atributos de las personas) ni el detector SSD (5,6 MB, más lento).

- **Carga diferida**: la biblioteca y los modelos se importan con `import()` solo al abrir la Estación de acceso o el diálogo "Registrar rostro", para no aumentar el tamaño de las demás pantallas.

## R3. Procesamiento en el frontend; solo el descriptor viaja al backend **[Equipo]**

- **Decision**: La cámara de la laptop (`getUserMedia`) se muestra en un `<video>`; la biblioteca detecta el rostro y calcula el descriptor (vector de 128 números) en el navegador. **Solo ese vector** se envía al backend (`POST`), nunca fotos, fotogramas ni vídeo. El vídeo no se graba ni se convierte a imágenes descargables; al salir de la pantalla se detienen todas las pistas de la cámara.
- **Captura de calidad**:
  - *Registro de rostro*: se toman **5 muestras** separadas ~300 ms con confianza de detección ≥ 0,6 y un solo rostro; si dos muestras difieren más de 0,4 (distancia euclidiana) se repite la captura; se envía el **promedio** de las muestras como único descriptor. Mejora la robustez ante pequeños cambios de pose.
  - *Estación*: se analiza ~4 veces por segundo; se calcula el descriptor cuando hay **exactamente un rostro**, con confianza ≥ 0,6, tamaño mínimo del 25 % del ancho del fotograma (solo quien está en la entrada, no personas lejanas: refuerza el no seguimiento) y estable durante 3 fotogramas seguidos. Con 0 o 2 o más rostros no se envía nada.
- **Entornos seguros**: `getUserMedia` solo funciona en `localhost` o HTTPS. El sistema corre en la laptop del acceso (`http://localhost:5173`); usar otra máquina de la red requeriría HTTPS (fuera de alcance, se documenta en el quickstart).
- **Alternatives considered**: enviar fotos al backend (descartado por decisión del equipo y privacidad); procesar en un servicio aparte (complejidad innecesaria).

## R4. Coincidencia y decisión de acceso en el backend **[Equipo]**

- **Decision**: El backend recibe el descriptor, lo valida (arreglo de **128 números finitos**, valores dentro de ±5, no todos cero), calcula la **distancia euclidiana** contra los descriptores de los rostros **activos** y aplica el **umbral 0,5** (más estricto que el 0,6 que sugiere la biblioteca).
  - Si **exactamente un cliente distinto** queda a distancia ≤ 0,5, se identifica a ese cliente.
  - Si ninguno, o si **dos o más clientes distintos** quedan dentro del umbral (coincidencia no clara), se rechaza como "Rostro no reconocido": nunca se autoriza por parecido dudoso.
  - Con el cliente identificado se valida: cliente activo → membresía en curso → pagada → vigente (R1), con los motivos del spec (FR-029).
- **Rationale**: La decisión de acceso vive en el servidor, no en el navegador (un cliente modificado no puede autorizarse solo). Con cientos o pocos miles de clientes comparar en memoria es inmediato; no hace falta índice vectorial.
- **Módulos independientes (Principio II/VIII)**: `rostros.service.js` (registro, cifrado y búsqueda de coincidencias) y `accesos.service.js` (validar membresía, registrar el intento) se comunican solo por llamadas de función; el segundo pide al primero "¿qué cliente es este descriptor?".
- **Alternatives considered**: comparar en la base con SQL (los descriptores van cifrados; no es posible); enviar al navegador los descriptores para comparar allí (expondría datos biométricos: prohibido).

## R5. Cifrado de descriptores: AES-256-GCM con `FACE_KEY` **[Equipo]**

- **Decision**: `node:crypto` (incluido en Node, **sin dependencias**). Cada descriptor (128 × `float32` little-endian = 512 bytes) se cifra con **AES-256-GCM**, un IV aleatorio de 12 bytes por registro y los **datos autenticados** `rostro:<id_cliente>` (así un blob copiado a la fila de otro cliente falla al descifrar). Formato guardado en `rostros.descriptor_facial` (BLOB): `versión(1 byte = 0x01) ‖ IV(12) ‖ etiqueta(16) ‖ texto cifrado(512)` = 541 bytes. El byte de versión permite rotar el algoritmo o la clave en el futuro.
- **Clave**: variable `FACE_KEY` en `backend/.env`: **64 caracteres hexadecimales** (32 bytes). `env.js` la valida al arrancar y detiene el servidor con un mensaje claro si falta o es inválida. Se agrega `FACE_KEY=` (sin valor) a `backend/.env.example` y `backend/.env.test.example`; el valor real nunca se sube. Generación: `node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log(randomBytes(32).toString('hex'))"`. Las pruebas usan una clave distinta, solo en `.env.test`.
- **Consecuencia**: si se pierde `FACE_KEY`, los rostros guardados no se pueden descifrar y hay que volver a registrarlos. Se documenta.
- **Alternatives considered**: AES-CBC sin autenticación (no detecta manipulación); cifrado a nivel de MySQL (la clave quedaría en la base); guardar el descriptor en claro (viola "protegida").

## R6. Un rostro activo por cliente **[Equipo]**

- **Decision**: La base no tiene restricción única para "un activo por cliente" (y no se agregan migraciones), así que se garantiza en el servicio con una transacción: se bloquea la fila del cliente (`SELECT … FOR UPDATE`), se pasan a `inactivo` los rostros activos de ese cliente y se inserta el nuevo. Reactivar un rostro inactivo (solo administrador) aplica el mismo intercambio. Desactivar no borra el descriptor (decisión de la clarificación).
- **Alternatives considered**: índice único parcial (no existe en MySQL y exigiría migración).

## R7. Intentos fallidos en la Estación: 3 seguidos y mensaje de ayuda **[Equipo]**

- **Decision**: La estación cuenta los rechazos **"Rostro no reconocido" consecutivos**. Al llegar a **3** muestra **"No te reconocemos. Pide ayuda en recepción"** y se pausa **30 segundos** (se conserva la pausa de la clarificación para evitar reintentos rápidos). El conteo vuelve a cero al identificar a un cliente (aunque se le rechace por otro motivo) y al terminar la pausa. Cada intento, incluido el tercero, lo registra el backend; durante la pausa no se envía ni se registra nada.
- **Dónde vive el conteo**: en el estado de la pantalla de la estación (navegador). La seguridad no depende de él: el backend decide y registra cada intento que recibe. Además el backend limita las peticiones de identificación por usuario (máximo 30 por minuto) para frenar un uso abusivo.
- **Cooldown de 10 s** para la misma persona: también en la estación (no repetir el intento mientras sigue de pie frente a la cámara).
- **Cambio respecto al spec**: la clarificación decía 5 rechazos; se actualiza a 3 con el nuevo mensaje (ver "Ajustes al spec").

## R8. Detección de vida: fuera de alcance **[Equipo]**

- Una fotografía del cliente podría engañar a la estación. Queda documentado como **limitación conocida** (spec, supuestos); se mitiga solo parcialmente con el umbral estricto, el tamaño mínimo del rostro y que cada intento queda registrado. Una solución futura (parpadeo, profundidad, cámara infrarroja) se evaluará en otro sprint.

## R9. Dependencias nuevas

| Dependencia | Dónde | Justificación (Principio III) |
|---|---|---|
| `@vladmandic/face-api@1.7.15` (exacta) | `frontend/` | Única forma elegida de obtener el descriptor facial localmente en el navegador (R2). MIT, sin dependencias propias, sin servicios externos. Peso: 1,3 MB de biblioteca + 7 MB de modelos, cargados solo en las pantallas de rostro y estación. |

No se agrega nada más: el cifrado usa `node:crypto`; la cámara usa la API del navegador `getUserMedia`; el Dashboard usa tarjetas y listas con los componentes existentes (sin librería de gráficas); las fechas se manejan con consultas SQL y `Date`. La versión se instala con `npm install --save-exact`.

## R10. Estructura de la API y reglas de permisos

- Rutas nuevas en `backend/src/routes/` (una por recurso) con `autenticar` + `autorizar(...)` y validación con los esquemas existentes (`zod`): ver [contracts/api-sprint2.md](contracts/api-sprint2.md).
- Los pagos reciben el `monto` y el servidor lo compara **en centavos** (enteros) con el precio vigente para no depender de decimales flotantes. Los montos de MySQL (`DECIMAL`) se convierten a número con dos decimales en las respuestas.
- El recepcionista consulta Tipos de membresía, Pagos y Adeudos; el entrenador solo recibe la proyección básica de accesos; el cliente solo accede a `GET /api/clientes/me/resumen`. Nadie recibe nunca el descriptor ni el campo `descriptor_facial`.
- Los datos biométricos no aparecen en ninguna respuesta: los serializadores de rostro devuelven solo `{ registrado, id_rostro, fecha_registro, estado }`.

## R11. Dashboard

- Un único `GET /api/dashboard` con `periodo=hoy|semana|mes|rango` (`desde`/`hasta` para el rango). El servidor calcula las fechas con `CURDATE()`: **semana** = lunes de la semana en curso hasta hoy; **mes** = día 1 hasta hoy; **rango** validado (desde ≤ hasta, sin fechas futuras, máximo 366 días).
- Estado actual (no depende del periodo): clientes activos y categorías vigente / por vencer / vencida con las reglas de R1 y FR-040. Del periodo: ingresos = suma de `pagos.monto` con estado `registrado` y `fecha_pago` dentro del periodo (consulta por rango para aprovechar `idx_pagos_fecha`); accesos autorizados/rechazados por `accesos.fecha` (`idx_accesos_fecha`); accesos recientes = los últimos 10 del periodo.
- **Alternatives considered**: varias llamadas separadas (más viajes y cifras inconsistentes entre sí); gráficas (fuera de alcance del sprint).

## R12. Auditoría

- Servicio `auditoria.service.js` con `registrar({ id_usuario, accion, modulo, resultado, descripcion })`. Los eventos de éxito se insertan **en la misma transacción** que la acción (si una falla, no queda la otra); los eventos de error (validaciones o permisos al intentar la operación) se registran después, sin impedir responder. Las descripciones nunca incluyen descriptores, contraseñas ni datos de tarjeta. Acciones: ver [data-model.md](data-model.md). Sin pantalla de consulta en este sprint.

## R13. Pruebas

- **Backend** (`node --test`, base `gymaccess_test`): unitarias de `membresia.js` (tabla de estados), `cifradoFacial.js` (ida y vuelta, manipulación detectada, otro `id_cliente` rechazado), `distanciaFacial.js` y `dinero.js`; de integración por recurso, con permisos por rol, reglas de negocio, el registro de **todos** los intentos de acceso y la comprobación de que **ningún** cuerpo de respuesta contiene el descriptor. Los descriptores de prueba son vectores sintéticos de 128 números (nunca rostros reales).
- **Frontend** (Vitest): el módulo `reconocimientoFacial.js` se sustituye por un doble en las pruebas (no se carga TensorFlow en jsdom) y `navigator.mediaDevices` se simula; se prueban pantallas, permisos de menú, estados vacíos y la estación (resultado, pausa tras 3 fallos, enfriamiento).
- **Manual** (quickstart): registro y entrada reales con la cámara de la laptop.

## R14. Frontend: menú, rutas y estación

- `config/menu.js`: nuevo bloque "Membresías y pagos" y las secciones del anexo del spec; `config/indicadores.js` y `config/tarjetasCliente.js` activan los elementos reservados en el rediseño (se cambia `disponible` a `true` y se asigna el componente).
- La **Estación de acceso** es una ruta propia (`/estacion`) **fuera del `Layout`** (sin menú ni encabezado), protegida para administrador y recepcionista, con botón "Salir" y botón opcional de pantalla completa del navegador (`requestFullscreen`). El menú lateral la abre con un enlace normal.
- El detalle del cliente suma la sección de membresía (asignar, renovar, pagar, suspender/reactivar/cancelar según rol) y de rostro (registrar, reemplazar, desactivar/reactivar), reutilizando los componentes comunes.

## Ajustes al spec derivados de estas decisiones

1. **Intentos fallidos** (FR-053, SC-015, escenario 13 de la historia 5, caso límite): de 5 a **3** rechazos "Rostro no reconocido" seguidos, con el mensaje "No te reconocemos. Pide ayuda en recepción" y pausa de 30 s.
2. **Precio de los planes** (FR-005 y escenarios de la historia 1): el precio debe ser **mayor a 0** (no se admiten planes gratuitos); se elimina el escenario de plan de $0 (historia 2) y la mención en FR-016/FR-009/suposiciones.
3. **Precio acordado** (FR-007, casos límite, suposiciones, entidades): una membresía **pagada** conserva su precio en `pagos.monto`; una **pendiente de pago** se cobra al precio vigente del plan. No se agregan columnas.
4. **Estado "pendiente de pago"** (suposiciones): se deriva (R1); se elimina la nota de que la planificación decidiría entre derivar o agregar un estado.
