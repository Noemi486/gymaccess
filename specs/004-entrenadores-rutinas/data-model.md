# Data Model: Sprint 3

El DDL completo está en `database/migrations/03_esquema_sprint3.sql`. Resumen:

| Tabla | Claves y relaciones | Reglas |
|---|---|---|
| `entrenadores` | `id_usuario` único → `usuarios` | Ficha opcional de una cuenta con rol entrenador; estado = el de la cuenta |
| `asignaciones_entrenador` | `id_cliente` → `clientes`; `id_entrenador`, `id_usuario` → `usuarios` | `estado` activa/finalizada; `fecha_fin` obligatoria al finalizar; única activa por cliente (`cliente_activa`) |
| `rutinas` | `id_cliente`, `id_entrenador`; `id_rutina_anterior` → `rutinas` | `estado` activa/archivada; única activa por cliente; versiones encadenadas |
| `ejercicios_rutina` | `id_rutina` → `rutinas`; único (`id_rutina`, `dia`, `orden`) | Día 1–7, orden 1–20, series 1–20, peso 0–500, descanso ≤ 600; series, repeticiones o instrucciones |
| `objetivos_entrenamiento` | `id_cliente`, `id_entrenador` | `estado` en_curso/cumplido/cancelado; `fecha_cierre` al cerrar |
| `progresos_clientes` | `id_cliente`, `id_entrenador` | Peso 20–400, grasa 2–70, cintura 30–250, al menos un dato; corregible solo el mismo día por su autor |

## Estados derivados y consultas clave

- **Cliente asignado a un entrenador** = existe una fila en `asignaciones_entrenador` con `estado = 'activa'`, ese `id_entrenador` y cliente con `estado = 'activo'`.
- **Puede gestionar** (entrenador X, cliente C) = asignación activa (X, C) y cuenta de X activa. Para consultar basta la asignación activa; para crear, además el cliente activo.
- **Entrenadores activos** = `usuarios.rol = 'entrenador' AND usuarios.estado = 'activo'`.
- **Avances en los últimos 30 días** = `progresos_clientes.fecha >= CURDATE() - INTERVAL 29 DAY`.

## Auditoría (módulo / acción)

| Módulo | Acciones |
|---|---|
| `entrenadores` | `crear`, `modificar`, `desactivar`, `activar` |
| `asignaciones` | `asignar`, `cambiar`, `quitar` |
| `rutinas` | `crear`, `versionar` |
| `objetivos` | `crear`, `modificar`, `cumplir`, `cancelar` |
| `progresos` | `registrar`, `corregir` |

Las descripciones llevan identificadores (por ejemplo, "Rutina 12 creada para el cliente 5"), nunca medidas, comentarios ni datos de salud.
