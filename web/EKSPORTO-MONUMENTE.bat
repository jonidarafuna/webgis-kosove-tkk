@echo off
cd /d "%~dp0"
echo Eksport GeoJSON per GitHub Pages...
node scripts/export-monuments-geojson.mjs
if errorlevel 1 pause
exit /b %errorlevel%
