@echo off
chcp 65001 >nul
cd /d "%~dp0"
title WebGIS - test lidhjeje
echo.
echo  === TEST LIDHJEJE (port 5500) ===
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  [GABIM] Node.js nuk u gjet. Instalo nga https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo  [OK] Node.js: 
node -v
echo.

netstat -ano | findstr ":5500" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
  echo  [INFO] Porti 5500 NUK eshte aktiv — serveri nuk punon.
  echo         Dy-klik HAPNI.bat dhe MOS e mbyll dritaren e zeze.
  echo.
  pause
  exit /b 1
)

echo  [OK] Dikush dëgjon ne portin 5500:
netstat -ano | findstr ":5500" | findstr "LISTENING"
echo.

echo  Duke provuar http://localhost:5500 ...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5500/api/health' -UseBasicParsing -TimeoutSec 5; Write-Host '  [OK] localhost:' $r.StatusCode $r.Content } catch { Write-Host '  [GABIM] localhost:' $_.Exception.Message; exit 1 }"
if errorlevel 1 goto :fail

for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "IP=%%i"
  goto :gotip
)
:gotip
set IP=%IP: =%
if not "%IP%"=="" (
  echo.
  echo  Duke provuar http://%IP%:5500 ...
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://%IP%:5500/api/health' -UseBasicParsing -TimeoutSec 5; Write-Host '  [OK] IP:' $r.StatusCode } catch { Write-Host '  [GABIM] IP:' $_.Exception.Message; exit 1 }"
  if errorlevel 1 goto :fail
  echo.
  echo  Per telefon perdor: http://%IP%:5500
)

echo.
echo  Gjithcka OK. Hap ne shfletues:
echo    http://localhost:5500
if not "%IP%"=="" echo    http://%IP%:5500
echo.
choice /C ON /M "Te hapet localhost ne shfletues tani"
if errorlevel 2 goto :end
start "" "http://localhost:5500"
goto :end

:fail
echo.
echo  Nese localhost deshton: mbyll Live Server, rinis HAPNI.bat
echo  Nese localhost OK por telefoni jo: LEJO-TELEFON.bat si Administrator
echo.
pause
exit /b 1

:end
pause
exit /b 0
