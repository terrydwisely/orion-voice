@echo off
echo Shutting down Orion Notes...

taskkill /F /IM electron.exe >nul 2>&1

for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":8432" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

echo Orion Notes stopped.
timeout /t 2 /nobreak >nul
