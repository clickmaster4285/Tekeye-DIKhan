@echo off
setlocal
cd /d "%~dp0"

if not exist "go2rtc.exe" (
  echo.
  echo  go2rtc.exe not found in tools\go2rtc\
  echo  Download Windows build from:
  echo    https://github.com/AlexxIT/go2rtc/releases
  echo  Extract go2rtc.exe into this folder, then run start-go2rtc.bat again.
  echo.
  pause
  exit /b 1
)

echo Starting go2rtc on :1984  (WebRTC :8555^)
echo Edit go2rtc.yaml webrtc.candidates to your LAN IP for remote browsers.
echo.
go2rtc.exe -config go2rtc.yaml
