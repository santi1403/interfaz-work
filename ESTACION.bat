@echo off
REM ESTACION - Unica estacion COMPARTIDA (todos ven la misma BD central)
set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%
set URL=http://192.168.10.129:8000/index.html
REM Verifica por TCP puerto 8000 (no por ping que bloquea firewall)
powershell -NoProfile -Command "try{ $c=New-Object System.Net.Sockets.TcpClient; $c.Connect('192.168.10.129',8000); $c.Close(); exit 0 }catch{ exit 1 }" >nul 2>nul
if %errorlevel%==0 (
  echo Conectado a estacion central 192.168.10.129 - todos ven lo mismo
) else (
  echo Estacion central no responde, iniciando servidor local en esta PC...
  start "ServidorPHP" /min cmd /c ""C:\xampp\php\php.exe" -S 0.0.0.0:8000 -t "%ROOT%""
  timeout /t 3 >nul
)

REM Abre como ventana app horizontal bonita 1366x800
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=%URL% --window-size=1366,800 & goto :end
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=%URL% --window-size=1366,800 & goto :end
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=%URL% --window-size=1366,800 & goto :end
start "" %URL%
:end
echo Estacion abierta en %URL% - crea/actualiza/elimina y queda guardado en MySQL
