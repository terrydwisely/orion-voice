@echo off
echo Installing Orion Voice dependencies...
pip install -r requirements.txt
cd desktop && npm install && cd ..
cd web && npm install && cd ..
echo Done!
