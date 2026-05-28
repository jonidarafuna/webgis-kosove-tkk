@echo off
:: Lejon hyrjen ne portin 5500 nga telefoni (Wi-Fi i njejte). Duhet "Run as administrator".
cd /d "%~dp0"
echo.
echo  Duke shtuar rregull ne Windows Firewall per portin 5500...
netsh advfirewall firewall delete rule name="WebGIS TKK 5500" >nul 2>&1
netsh advfirewall firewall add rule name="WebGIS TKK 5500" dir=in action=allow protocol=TCP localport=5500
if errorlevel 1 (
  echo.
  echo  GABIM: Kliko djathtas mbi LEJO-TELEFON.bat -^> Run as administrator
  pause
  exit /b 1
)
echo.
echo  U shtua rregulli. Tani:
echo    1. Nis HAPNI.bat
echo    2. Ne telefon: http://IP_E_PC:5500  (shiko IP ne dritaren e serve.js)
echo    3. Wi-Fi i njejte; mos perdor localhost
echo.
pause
