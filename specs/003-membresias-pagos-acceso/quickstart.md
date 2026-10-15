# Quickstart: validar el Sprint 2

Guía para comprobar de punta a punta el flujo membresía → pago → rostro → entrada. Detalles de endpoints en [contracts/api-sprint2.md](contracts/api-sprint2.md); reglas de estado en [data-model.md](data-model.md).

## Prerrequisitos

- Bases `gymaccess` (real) y `gymaccess_test` (pruebas) creadas; **no se requieren migraciones nuevas**.
- Una laptop con **cámara web** y **Chrome o Edge** abierto en `http://localhost:5173` (la cámara solo funciona en `localhost` o HTTPS).
- **`FACE_KEY`** en `backend/.env` y en `backend/.env.test` (valores distintos). Es una clave de 64 caracteres hexadecimales; generarla así y pegarla sin comillas:

  ```text
  node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log(randomBytes(32).toString('hex'))"
  ```

  Guárdala en un lugar seguro: si se pierde, hay que volver a registrar todos los rostros. `backend/.env.example` lleva `FACE_KEY=` **sin valor** y los `.env` no se suben a Git.
- Dependencias instaladas (`npm install` en `frontend/`) y los modelos presentes en `frontend/public/models/` (tres modelos, ≈ 7 MB; ver su `LEEME.md`).

## Levantar el sistema y las pruebas

```text
Backend:   cd backend  && npm run dev   → http://localhost:3000
Frontend:  cd frontend && npm run dev   → http://localhost:5173
Pruebas:   cd backend  && npm test       (usa SOLO gymaccess_test)
           cd frontend && npm test
```

Resultado esperado: todas las pruebas en verde (SC-014); el arranque del backend falla con un mensaje claro si falta o es inválida la `FACE_KEY`.

## Recorrido manual (demostración)

1. **Plan** (administrador): en *Tipos de membresía* crear "Plan Mensual" (30 días, $450). Entrar como recepcionista: solo puede consultarlo.
2. **Asignar y cobrar** (recepcionista): en el detalle de un cliente, *Asignar membresía* → Plan Mensual → marcar "Registrar el pago ahora" → efectivo. La membresía queda **vigente** sin adeudo.
3. **Pendiente de pago**: a otro cliente asignarle el plan **sin** pagar. Aparece "Pendiente de pago" y en *Adeudos*. Intentar pagar un monto distinto de $450 → error; pagar $450 → pasa a vigente y sale de Adeudos.
4. **Rostro**: en el detalle del cliente, *Registrar rostro* → confirmar el consentimiento → mirar la cámara hasta completar las 5 muestras. Debe figurar "Rostro registrado". Revisar en la pestaña *Red* del navegador que la petición lleva solo 128 números, nunca imágenes.
5. **Entrada autorizada**: abrir *Estación de acceso* (pantalla completa, sin menú). Presentarse con el cliente del paso 2 → verde "Acceso autorizado" con nombre, plan y días restantes.
6. **Rechazos**: presentarse con (a) el cliente con adeudo → "Pago pendiente"; (b) un cliente con membresía vencida, suspendida o cancelada (cambiando fechas o estado en datos de prueba) → su motivo; (c) alguien sin rostro registrado → "Rostro no reconocido".
7. **Intentos repetidos**: tres "Rostro no reconocido" seguidos → mensaje "No te reconocemos. Pide ayuda en recepción" y pausa de 30 s.
8. **Accesos**: en *Accesos* ver todos los intentos con su resultado y motivo; filtrar por fecha y resultado. Como entrenador, ver la versión básica.
9. **Dashboard** (administrador): cambiar entre Hoy, Semana, Mes y un Rango; las cifras coinciden con *Pagos* y *Accesos*. Un rango inválido muestra error.
10. **Inicios**: el cliente ve sus 4 tarjetas (membresía con barra de color, acceso facial, visitas, pagos); administrador y recepcionista ven "Accesos de hoy" y "Membresías por vencer"; el entrenador ve "Clientes que entraron hoy".
11. **Menú y permisos**: comparar el menú de cada rol con el anexo del spec y comprobar que las rutas no permitidas muestran "Sin permiso" y el servidor responde 403.
12. **Auditoría**: tras las acciones anteriores, consultar `SELECT accion, modulo, resultado FROM auditoria ORDER BY id_auditoria DESC LIMIT 20;` en la base de pruebas o de desarrollo (con un usuario con permiso de lectura): debe haber un evento por acción y ninguno contiene datos biométricos.

## Comprobaciones de seguridad

- Revisar con las herramientas del navegador (pestaña *Red*) y con las pruebas automáticas que **ninguna respuesta** contiene `descriptor` ni `descriptor_facial`.
- En la base: `SELECT id_rostro, id_cliente, LENGTH(descriptor_facial) FROM rostros;` → longitud 541 y contenido ilegible.
- Apagar la cámara al salir de la estación: el indicador de la cámara del equipo debe apagarse.

## Limitaciones conocidas

- Sin detección de vida: una fotografía del cliente podría engañar a la estación. Mitigaciones parciales: umbral estricto (0,5), exigir un rostro grande y cercano, y que cada intento queda registrado.
- Si cambian la `FACE_KEY` o los modelos, los rostros registrados deben volver a capturarse.
- Usar la estación desde otro equipo de la red requiere HTTPS.
