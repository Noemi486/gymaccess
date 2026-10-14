# Quickstart: validar el rediseño de interfaz

## Prerrequisitos

- Base `gymaccess` local con datos de Sprint 1 y usuarios de prueba de los 4 roles (administrador, recepcionista, entrenador, cliente).
- Dependencias instaladas en `frontend/` (incluye la nueva librería de íconos tras `npm install`).

## Levantar el sistema

```text
Backend:   cd backend  && npm run dev   → http://localhost:3000
Frontend:  cd frontend && npm run dev   → http://localhost:5173
```

## Pruebas automáticas

```text
cd frontend && npm test     # incluye menú por rol, componentes y pantallas migradas
cd backend  && npm test     # debe seguir pasando sin cambios (usa gymaccess_test)
cd frontend && npm run build
```

Resultado esperado: todo en verde (SC-010).

## Recorrido manual

1. **Menú por rol (FR-002, SC-002)**: iniciar sesión con cada rol y comparar el menú con el Anexo del spec. Administrador: Inicio, Clientes, Usuarios y roles. Recepcionista y entrenador: Inicio, Clientes. Cliente: Inicio, Mi información.
2. **Sección activa y encabezado (FR-003, FR-006)**: navegar entre secciones; la opción actual se resalta y el título, nombre y rol se muestran. Cerrar sesión lleva a `/login`.
3. **Inicio (FR-007, FR-021)**: saludo con fecha y resumen según rol (administrador: 4 indicadores, últimos 5 clientes y usuarios por rol; recepcionista: buscador, activos, registrados hoy y últimos 5; entrenador: buscador y activos; cliente: su información). "+ Registrar cliente" solo para administrador y recepcionista. El buscador lleva a `/clientes?q=…`. Las cifras coinciden con las listas.
4. **Listas (FR-009)**: en Usuarios y Clientes verificar tabla con encabezado fijo, paginación y estado vacío (buscar un texto inexistente).
5. **Formularios (FR-010, FR-012)**: enviar datos inválidos → error por campo; guardar uno válido → botón en carga y aviso de éxito.
6. **Bajas (FR-013)**: inactivar un cliente/usuario → aparece la confirmación; cancelar no cambia nada.
7. **Estados (FR-011)**: las insignias muestran color y texto.
8. **Pantalla pequeña (FR-005, SC-006)**: reducir la ventana a < 1024 px y luego a 360 px; el menú se oculta, se abre con el botón, se cierra al elegir una sección; no hay desplazamiento horizontal de la página.
9. **403 / 404 (FR-014)**: con rol recepcionista abrir `/usuarios` → “Sin permiso”; abrir `/ruta-inexistente` → “No encontrado”; ambas con botón para volver al inicio. Comprobar también que el backend sigue respondiendo 403 a esas peticiones directas.
10. **Extensibilidad (SC-004)**: agregar temporalmente una entrada en `config/menu.js` y comprobar que aparece solo para los roles indicados; revertirla.
11. **Tokens (FR-015, SC-005)**: buscar en `frontend/src` colores literales (`#`, `rgb(`, `hsl(`) fuera de `styles/tokens.css`; no debe haber ninguno.
12. **Contraste**: verificar que el texto sobre el acento verde lima y los textos secundarios cumplen contraste mínimo 4.5:1.

Detalles de los componentes y del menú: [contracts/ui-contracts.md](contracts/ui-contracts.md) y [data-model.md](data-model.md).
