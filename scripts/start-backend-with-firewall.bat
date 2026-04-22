@echo off
setlocal

cd /d "%~dp0\.."

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Requesting administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "RULE_NAME=Xueyin Backend 3000"

echo.
echo [1/4] Turning off Windows Firewall profiles...
netsh advfirewall set allprofiles state off >nul

echo [2/4] Resetting firewall rule for port 3000...
netsh advfirewall firewall delete rule name="%RULE_NAME%" >nul 2>&1
netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=3000 profile=private,public >nul

echo [3/4] Current IPv4 addresses:
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -like '172.*' } | Select-Object IPAddress,InterfaceAlias | Format-Table -AutoSize"

echo [4/4] Moving to backend directory...
cd /d "%cd%\backend"

echo [5/5] Starting backend on port 3000...
echo.
echo Windows Firewall is currently OFF. Re-enable it after testing if needed.
echo If you are using phone hotspot or a new Wi-Fi, remember to sync the latest LAN IP into miniprogram\utils\request.ts
echo.

call npm start

endlocal
