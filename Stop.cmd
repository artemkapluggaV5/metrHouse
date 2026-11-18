@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0bin\stand.ps1" -Stop
if errorlevel 1 pause

