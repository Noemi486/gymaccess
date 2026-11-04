# Respaldo diario de la base de datos local

GymAccess guarda todo en MySQL, en la laptop del gimnasio, y no necesita internet (FR-065). Para no perder la información si la laptop falla, el sistema hace **un respaldo automático cada día a las 23:00** y conserva **los últimos 7** (US13, FR-059 a FR-064).

| Qué | Cómo |
|---|---|
| Comando | `npm run respaldo` (en `backend/`) |
| Usuario de MySQL | `gymaccess_respaldo`, solo lectura sobre `gymaccess` |
| Archivo | `gymaccess_AAAA-MM-DD_HHMM.sql` en la carpeta `RESPALDO_DIR` |
| Bitácora | `respaldos.log` en la misma carpeta (fecha, resultado, archivo o error) |
| Cuántos se guardan | Los 7 más recientes; un respaldo fallido no borra ninguno |
| Qué NO incluye | La llave `FACE_KEY`, los archivos `.env` ni contraseñas. Los rostros van cifrados igual que en la base |

> Sin la llave `FACE_KEY` los rostros de un respaldo no se pueden descifrar. Guarda una copia de la llave en un lugar seguro **aparte** (nunca en la carpeta de respaldos ni en Git).

## 1. Crear el usuario de respaldo (una sola vez)

1. Abre `database/scripts/crear-usuario-respaldo.sql` y cambia `CAMBIA_ESTA_CONTRASENA` por una contraseña nueva.
2. Ejecútalo como `root` en MySQL Workbench (abrir y ejecutar todo) o en la terminal, desde la raíz del proyecto:
   ```powershell
   mysql -u root -p -e "source database/scripts/crear-usuario-respaldo.sql"
   ```
3. Al final debe mostrar `GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES ON gymaccess.*`.
4. Regresa el archivo a `CAMBIA_ESTA_CONTRASENA` para no dejar la contraseña real en el proyecto.

## 2. Configurar `backend/.env`

Agrega (los nombres están en `backend/.env.example`):

```text
RESPALDO_DB_USER=gymaccess_respaldo
RESPALDO_DB_PASSWORD=la contraseña del paso 1
RESPALDO_DIR=D:\RespaldosGymAccess
MYSQLDUMP_PATH=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe
```

- `RESPALDO_DIR`: de preferencia **otro disco o una USB**. La carpeta debe existir (créala antes).
- `MYSQLDUMP_PATH`: solo si `mysqldump` no está en el PATH. Ajusta la versión (`8.0`, `8.4`, `9.x`) a la que tengas instalada.

## 3. Probarlo a mano

```powershell
cd "C:\Gestion de Proyectos\gym-system\backend"
npm run respaldo
```

Debe decir `Respaldo creado: ...gymaccess_2026-11-03_2300.sql (... bytes).` y en la carpeta deben aparecer el archivo y `respaldos.log`.

## 4. Programarlo a las 23:00 (Programador de tareas de Windows)

La tarea ejecuta `backend\scripts\respaldo.cmd`, que entra a `backend` y corre `npm run respaldo`. En PowerShell, **una línea a la vez** (ajusta la ruta si tu proyecto está en otro lugar):

```powershell
$accion = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "C:\Gestion de Proyectos\gym-system\backend\scripts\respaldo.cmd"'
$hora = New-ScheduledTaskTrigger -Daily -At 11:00PM
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask -TaskName 'GymAccess - Respaldo diario' -Action $accion -Trigger $hora -Settings $config
```

`-StartWhenAvailable` hace que, si la laptop estaba apagada a las 23:00, el respaldo se haga en cuanto se encienda.

Para probar la tarea sin esperar:

```powershell
Start-ScheduledTask -TaskName 'GymAccess - Respaldo diario'
```

y revisa `respaldos.log` en la carpeta de respaldo. También la ves en el **Programador de tareas** → *Biblioteca del Programador de tareas*.

## 5. Restaurar un respaldo (en una base de prueba)

Nunca restaures directamente sobre `gymaccess` sin que el equipo lo decida. Para comprobar un respaldo:

```powershell
mysql -u root -p -e "CREATE DATABASE gymaccess_restaurada CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p gymaccess_restaurada < "D:\RespaldosGymAccess\gymaccess_2026-11-03_2300.sql"
```

(En PowerShell, si `<` no funciona, usa `cmd /c "mysql -u root -p gymaccess_restaurada < D:\RespaldosGymAccess\gymaccess_2026-11-03_2300.sql"`.)

Compara las cantidades con la base original (SC-022):

```sql
SELECT (SELECT COUNT(*) FROM gymaccess.clientes) AS clientes_original,
       (SELECT COUNT(*) FROM gymaccess_restaurada.clientes) AS clientes_respaldo,
       (SELECT COUNT(*) FROM gymaccess.pagos) AS pagos_original,
       (SELECT COUNT(*) FROM gymaccess_restaurada.pagos) AS pagos_respaldo,
       (SELECT COUNT(*) FROM gymaccess.accesos) AS accesos_original,
       (SELECT COUNT(*) FROM gymaccess_restaurada.accesos) AS accesos_respaldo;
```

Al terminar la comprobación: `DROP DATABASE gymaccess_restaurada;` (solo esa base de prueba).

## Problemas comunes

| Mensaje en `respaldos.log` | Qué hacer |
|---|---|
| `No se encontró mysqldump` | Pon la ruta completa en `MYSQLDUMP_PATH`. |
| `Access denied for user 'gymaccess_respaldo'` | La contraseña de `.env` no coincide con la del paso 1, o no se ejecutó el script. |
| `La carpeta de respaldo no existe` | Crea la carpeta o corrige `RESPALDO_DIR` (si es USB, que esté conectada). |
| Menciona `RELOAD` o `FLUSH_TABLES` | Tu servidor tiene GTID activo: como root, `GRANT FLUSH_TABLES ON *.* TO 'gymaccess_respaldo'@'localhost';` |
| `El respaldo quedó incompleto` | Revisa espacio en disco y vuelve a ejecutar `npm run respaldo`. |
