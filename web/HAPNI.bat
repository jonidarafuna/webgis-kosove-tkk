@echo off
REM SKEDARI: HAPNI.bat
REM QELLIMI: Nis node serve.js ne portin 5500 dhe hap shfletuesin.
REM KERKON: Node.js + GeoServer ON (per WMS/WFS).
REM MOS PERDOR: Live Server / dy-klik mbi index.html
chcp 65001 >nul
cd /d "%~dp0"
title WebGIS Kosove - server (MOS MBYLL)
echo.
echo  ========================================
echo   WebGIS - MOS MBYLL KETE DRITARE
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  [GABIM] Node.js nuk u gjet ne PATH.
  echo  Instalo Node.js: https://nodejs.org
  echo  Pastaj mbyll dhe rihap kete dritare.
  echo.
  pause
  exit /b 1
)

echo  GeoServer duhet te jete ON (Start GeoServer)
echo.
echo  Duke liruar portin 5500 (Live Server / serve i vjeter)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5500" ^| findstr "LISTENING"') do (
  echo  Duke mbyllur procesin PID %%a ...
  taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
echo  Duke nisur node serve.js ...
echo  Kur te shfaqet "Faqja (telefon):" provo ate URL.
echo.
start "" "http://localhost:5500"
node serve.js
echo.
echo  Serveri u ndal ose ka gabim (kodi i mesiperm).
echo  Nese shikon gabim porti i zene, mbyll Live Server ne VS Code.
echo.
pause

