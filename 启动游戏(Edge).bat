@echo off
chcp 65001 >nul
rem ???? ? ????? Edge ?????????? JavaScript?????? IE?
set "GAME=%~dp0index.html"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --new-window "%GAME%"
) else (
  start "" "%GAME%"
)
exit /b