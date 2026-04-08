@echo off
set found=0

tasklist /FI "IMAGENAME eq cnc_m.exe" 2>NUL | find /I /N "cnc_m.exe">NUL
if "%ERRORLEVEL%"=="0" set found=1

tasklist /FI "IMAGENAME eq pcommserver.exe" 2>NUL | find /I /N "pcommserver.exe">NUL
if "%ERRORLEVEL%"=="0" set found=1

if "%found%"=="0" (
  echo NOT_FOUND
  exit /b 1
)

taskkill /F /IM cnc_m.exe 2>nul
taskkill /F /IM pcommserver.exe 2>nul
echo OK
exit /b 0
