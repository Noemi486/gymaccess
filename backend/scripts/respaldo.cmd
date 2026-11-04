@echo off
rem Respaldo diario de GymAccess (lo ejecuta el Programador de tareas de Windows; ver docs/respaldo.md).
cd /d "%~dp0.."
npm run respaldo
