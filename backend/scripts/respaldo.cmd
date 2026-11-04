@echo off
rem Respaldo diario de GymAccess (lo ejecuta el Programador de tareas de Windows; ver docs/respaldo.md).
rem La salida se agrega a backend\respaldo-tarea.log (ignorado por Git) para revisar la tarea si falla.
cd /d "%~dp0.."
echo ==== %date% %time% >> respaldo-tarea.log
call npm run respaldo >> respaldo-tarea.log 2>&1
