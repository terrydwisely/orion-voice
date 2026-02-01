@echo off
echo Installing Orion Notes dependencies...
pip install -r requirements.txt
cd desktop && npm install && cd ..
cd web && npm install && cd ..
echo Done!
