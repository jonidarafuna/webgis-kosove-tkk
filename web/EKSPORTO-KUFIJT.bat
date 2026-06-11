@echo off
REM SKEDARI: EKSPORTO-KUFIJT.bat
REM QELLIMI: Eksporton Kosova/Rajonet/Komunat nga GeoServer ne GeoJSON (GitHub Pages).
REM KERKON: GeoServer ON + HAPNI.bat
cd /d "%~dp0"echo Eksport kufijve per GitHub Pages...
node scripts/export-admin-geojson.mjs
if errorlevel 1 pause
exit /b %errorlevel%
