@echo off
cd /d %~dp0
if exist backend\.venv (
  echo Eliminando backend\.venv...
  rmdir /s /q backend\.venv
)
echo Listo. Ejecuta .\start.bat para recrearlo con Python 3.11.
pause
