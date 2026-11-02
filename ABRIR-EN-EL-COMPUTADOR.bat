@echo off
title Mis Prestamos
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo No encontre Python en este computador.
  pause
  exit /b 1
)
netstat -ano | find ":8080" | find "LISTENING" >nul
if errorlevel 1 (
  start "Mis Prestamos - no cerrar esta ventana" /min python -m http.server 8080 --bind 127.0.0.1
  ping -n 3 127.0.0.1 >nul
)
start "" http://localhost:8080/
