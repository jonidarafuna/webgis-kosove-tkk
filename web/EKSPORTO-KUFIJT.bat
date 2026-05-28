@echo off
cd /d "%~dp0"
echo Eksport kufijve per GitHub Pages...
node scripts/export-admin-geojson.mjs
if errorlevel 1 pause
exit /b %errorlevel%
