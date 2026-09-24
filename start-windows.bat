@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Bitte installiere zuerst Node.js 20 oder neuer.
  echo https://nodejs.org/
  pause
  exit /b 1
)
echo Kartenwerk startet lokal. Lass dieses Fenster geoeffnet.
echo Danach im Browser http://127.0.0.1:4173 oeffnen.
npm start
pause
