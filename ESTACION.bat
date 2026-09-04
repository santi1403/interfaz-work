@echo off
REM ESTACION - Unica estacion (compartida + fallback local) - No tocar logica del proyecto
set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%
set URL_COMPARTIDA=http://192.168.10.111:8000/index.html
set URL_LOCAL=http://localhost:8000/index.html

REM Intenta conectar a la BD central (tu PC) si esta en la misma red
ping -n 1 -w 800 192.168.10.111 >nul 2>nul
if %errorlevel%==0 (
  echo Conectado a estacion central 192.168.10.111 - modo compartido
  set URL=%URL_COMPARTIDA%
) else (
  echo Estacion central no alcanzable - modo local
  echo Iniciando servidor local...
  start "ServidorPHP" /min cmd /c ""C:\xampp\php\php.exe" -S 0.0.0.0:8000 -t "%ROOT%""
  timeout /t 2 >nul
  set URL=%URL_LOCAL%
)

REM Abre como ventana app horizontal bonita 1366x800
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=%URL% --window-size=1366,800 & goto :end
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=%URL% --window-size=1366,800 & goto :end
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=%URL% --window-size=1366,800 & goto :end
start "" %URL%
:end
echo Estacion abierta en %URL% - crea/actualiza/elimina y queda guardado en MySQL
