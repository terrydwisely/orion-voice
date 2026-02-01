@echo off
title Orion Voice
echo Starting Orion Voice...

:: Start the Python backend
start /B "" "C:\Users\terry\AppData\Local\Programs\Python\Python312\python.exe" -m orion_voice --mode server --port 8432

:: Start the web dev server
cd /d "C:\Users\terry\Projects\orion-voice\web"
start /B "" npx vite --port 5173 --host 0.0.0.0

:: Wait for servers to start
timeout /t 4 /nobreak >nul

:: Launch Electron desktop app (must unset ELECTRON_RUN_AS_NODE)
set ELECTRON_RUN_AS_NODE=
start "" "C:\Users\terry\Projects\orion-voice\desktop\node_modules\electron\dist\electron.exe" "C:\Users\terry\Projects\orion-voice"

:: Also open web browser as backup
start http://localhost:5173

echo.
echo Orion Voice is running!
echo Backend: http://localhost:8432
echo Web App: http://localhost:5173
echo Desktop: Electron window
echo.
echo Press any key to STOP Orion Voice...
pause >nul

echo.
echo Shutting down Orion Voice...

:: Kill all Orion Voice processes
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM "python.exe" /FI "WINDOWTITLE eq Orion*" >nul 2>&1

:: Kill the python backend by port
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":8432" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

:: Kill the vite dev server by port
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

echo Orion Voice stopped.
timeout /t 2 /nobreak >nul
