@echo off
setlocal enabledelayedexpansion
cd /d %~dp0

echo ========================================
echo OpsPilot for New Relic - Windows launcher
echo Target Python: 3.11.x ^(recommended 3.11.9^)
echo ========================================
echo.

if not exist .env (
  copy .env.example .env >nul
  echo Created .env from .env.example.
  echo Edit .env if you have not configured your New Relic credentials yet.
  echo.
)

set PY_CMD=
py -3.11 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)" >nul 2>nul
if %errorlevel%==0 set PY_CMD=py -3.11

if not defined PY_CMD (
  python -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)" >nul 2>nul
  if !errorlevel!==0 set PY_CMD=python
)

if not defined PY_CMD (
  echo ERROR: Python 3.11 no fue encontrado.
  echo Instala Python 3.11.9 desde https://www.python.org/downloads/release/python-3119/
  echo Durante la instalacion marca: Add python.exe to PATH.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('%PY_CMD% -c "import sys; print(sys.version.split()[0])"') do set PY_VERSION=%%v
echo Usando Python %PY_VERSION%

set RECREATE_VENV=0
if not exist backend\.venv set RECREATE_VENV=1
if exist backend\.venv\Scripts\python.exe (
  backend\.venv\Scripts\python.exe -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)" >nul 2>nul
  if errorlevel 1 set RECREATE_VENV=1
)

if "%RECREATE_VENV%"=="1" (
  if exist backend\.venv (
    echo Eliminando venv incompatible...
    rmdir /s /q backend\.venv
  )
  echo Creando venv con Python 3.11...
  %PY_CMD% -m venv backend\.venv
  if errorlevel 1 (
    echo ERROR: no se pudo crear el entorno virtual.
    pause
    exit /b 1
  )
)

call backend\.venv\Scripts\activate.bat
python -m pip install --upgrade "pip==25.3"
python -m pip install -r backend\requirements.txt
if errorlevel 1 (
  echo ERROR instalando dependencias de backend.
  pause
  exit /b 1
)

cd frontend
if not exist node_modules (
  npm install --legacy-peer-deps
  if errorlevel 1 (
    echo ERROR instalando dependencias de frontend.
    pause
    exit /b 1
  )
)
cd ..

start "OpsPilot Backend" cmd /k "call backend\.venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir backend"
start "OpsPilot Frontend" cmd /k "cd frontend && npm run dev"
start http://localhost:3000

echo.
echo OpsPilot iniciado.
echo Backend:  http://localhost:8000/api/health
echo Frontend: http://localhost:3000
echo Cierra las ventanas Backend y Frontend para detener los servicios.
endlocal
