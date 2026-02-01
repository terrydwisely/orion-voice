@echo off
cd /d "%~dp0"
ren node_modules\electron electron_npm
node_modules\electron_npm\dist\electron.exe .
ren node_modules\electron_npm electron
