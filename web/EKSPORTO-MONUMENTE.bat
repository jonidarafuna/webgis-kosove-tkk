@echo off
REM SKEDARI: EKSPORTO-MONUMENTE.bat
REM QELLIMI: Merr monumentet nga GeoServer (WFS) dhe i ruan si GeoJSON per GitHub Pages.
REM KERKON: GeoServer ON + HAPNI.bat ne dritare tjeter.
cd /d "%~dp0"echo Eksport GeoJSON per GitHub Pages...
node scripts/export-monuments-geojson.mjs
if errorlevel 1 pause
exit /b %errorlevel%
