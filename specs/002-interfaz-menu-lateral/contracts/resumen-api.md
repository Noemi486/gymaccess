# Contrato: GET /api/resumen

Endpoint de **solo lectura** para el panel de resumen del Inicio. Aprobado por el equipo el 2026-10-13. No modifica datos; no existen POST, PATCH ni DELETE sobre esta ruta.

## Acceso

| Rol | Resultado |
|---|---|
| Sin sesión | 401 |
| `cliente` | 403 (consulta su información con `GET /api/clientes/me`) |
| `administrador`, `recepcionista`, `entrenador` | 200, con **solo** lo que su rol puede ver |

El rol se valida en el backend (middlewares `autenticar` y `autorizar`), y el servicio vuelve a comprobarlo.

## Respuesta 200 por rol

```jsonc
// administrador
{
  "clientes": { "activos": 40, "inactivos": 7, "registrados_mes": 12 },
  "usuarios": { "total": 9, "por_rol": { "administrador": 1, "recepcionista": 3, "entrenador": 2, "cliente": 3 } },
  "ultimos_clientes": [ /* 5 como máximo, vista completa del cliente */ ]
}
// recepcionista
{
  "clientes": { "activos": 40, "registrados_hoy": 2 },
  "ultimos_clientes": [ /* 5 como máximo, vista completa del cliente */ ]
}
// entrenador (sin contacto ni cifras de usuarios)
{ "clientes": { "activos": 40 } }
```

- `ultimos_clientes`: del más reciente al más antiguo (`fecha_registro` descendente; el id desempata).
- `usuarios.total` y `por_rol` cuentan todas las cuentas, activas o no (coincide con `GET /api/usuarios`).
- "Hoy" y "este mes" se calculan con el reloj de MySQL, el mismo que asigna `fecha_registro`.

## Extensión en Sprint 2

El servicio (`backend/src/services/resumen.service.js`) arma la respuesta con una lista de entradas `{ clave, roles, obtener }`. Para sumar `accesos` (accesos de hoy) o `membresias` (por vencer) se añade una entrada nueva con sus roles; las existentes no cambian. En el frontend se activa cambiando `disponible` a `true` en `frontend/src/config/indicadores.js`.

## Pruebas

`backend/tests/integration/resumen.test.js`, contra la base `gymaccess_test`.
