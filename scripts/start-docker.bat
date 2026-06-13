@echo off
REM Start Docker Desktop and wait for the engine before launching Postgres + Redis.
echo Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo Waiting for Docker engine (up to 120 seconds)...
set /a count=0
:waitloop
docker info >nul 2>&1
if %errorlevel%==0 goto ready
timeout /t 5 /nobreak >nul
set /a count+=5
if %count% geq 120 goto failed
goto waitloop

:ready
echo Docker is ready. Starting containers...
cd /d "%~dp0..\server"
docker compose up -d
if %errorlevel%==0 (
  echo PostgreSQL and Redis are running.
  exit /b 0
)

:failed
echo Docker did not start in time. Open Docker Desktop manually, then run:
echo   cd server ^&^& docker compose up -d
exit /b 1
