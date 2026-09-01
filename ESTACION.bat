@echo off
REM ESTACION.bat - Modo aplicacion/kiosk sin tocar codigo
REM Inicia PHP y abre la interfaz como ventana emergente tipo app (sin barra de navegador)
set ROOT=%~dp0
REM Corta la ultima \ si existe
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

echo Iniciando estacion...
REM Inicia servidor PHP en segundo plano en 0.0.0.0:8000
start "ServidorPHP" /min cmd /c ""C:\xampp\php\php.exe" -S 0.0.0.0:8000 -t "%ROOT%""

REM Espera 2s a que levante
timeout /t 2 /nobreak >nul

REM Intenta Chrome en modo app (ventana sin pestañas) - estilo aplicacion/tablet
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:8000 --window-size=1280,800 --user-data-dir="%ROOT%\.chrome-estacion"
  goto :end
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
  start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=http://localhost:8000 --window-size=1280,800 --user-data-dir="%ROOT%\.chrome-estacion"
  goto :end
)
REM Fallback Edge en modo app
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:8000 --window-size=1280,800
  goto :end
)
REM Fallback navegador por defecto
start "" http://localhost:8000

:end
echo Estacion lanzada. No cierres esta ventana, minimizala.
pause
