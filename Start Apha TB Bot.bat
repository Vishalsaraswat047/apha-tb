@echo off
setlocal

cd /d "%~dp0"
title Apha TB Bot

echo Starting Apha TB Bot...
echo.

curl.exe -s --max-time 2 "http://localhost:3004/" >nul 2>nul
if not errorlevel 1 (
  echo The bot is already running.
  start "" "http://localhost:3004"
  exit /b 0
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm was not found on this computer.
  echo Install Node.js first, then run this shortcut again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo First run detected. Installing app files...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Install failed. Check the message above, then try again.
    pause
    exit /b 1
  )
  echo.
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo Created .env from the example file.
    echo Add your Gemini API key in .env if the bot needs AI features.
    echo.
  )
)

set DISABLE_HMR=true
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "for ($i=0; $i -lt 15; $i++) { if (Test-Path '.\server_port.json') { break } ; Start-Sleep -Seconds 1 }; if (Test-Path '.\server_port.json') { $port = (Get-Content '.\server_port.json' | ConvertFrom-Json).port; Start-Process \"http://localhost:$port\" } else { Start-Process 'http://localhost:3004' }"
call npm.cmd run dev

echo.
echo The bot stopped.
pause
