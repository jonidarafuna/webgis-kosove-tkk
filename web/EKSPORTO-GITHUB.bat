@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Eksport për GitHub Pages ===
echo Kërkon: GeoServer ON + HAPNI.bat (http://localhost:5500)
echo.

call node scripts\export-monuments-geojson.mjs
if errorlevel 1 goto :fail

call node scripts\export-admin-geojson.mjs
if errorlevel 1 goto :fail

call node scripts\verify-static-data.mjs
if errorlevel 1 goto :fail

echo.
echo Gati. Bëj git add web\data ^&^& git commit ^&^& git push
echo.
pause
exit /b 0

:fail
echo.
echo Eksporti dështoi.
pause
exit /b 1
