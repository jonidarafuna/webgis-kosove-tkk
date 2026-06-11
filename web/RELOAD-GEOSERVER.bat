@echo off
REM SKEDARI: RELOAD-GEOSERVER.bat
REM QELLIMI: Rifreskon store-in detyra_gpkg pas ndryshimeve ne DetyraGPKG.gpkg
REM KERKON: GeoServer ON (Start GeoServer)
cd /d "%~dp0"
chcp 65001 >nul
echo.
echo  ========================================
echo   Reload GeoServer store (detyra_gpkg)
echo  ========================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo  [GABIM] Node.js nuk u gjet.
  pause
  exit /b 1
)
node scripts/reload-geoserver-store.mjs
if errorlevel 1 pause
exit /b %errorlevel%
