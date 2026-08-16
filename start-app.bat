@echo off
title CityZen Smart City App
echo ========================================================
echo       CITY ZEN - One City. One App. (Bhubaneswar)
echo           Cross-Platform Desktop & Mobile App
echo ========================================================
echo.
echo Building latest version...
call npm run build

echo.
echo Starting local app server on port 8080 ...
start /min cmd /c "python -m http.server 8080 --directory "%~dp0dist""

timeout /t 1 /nobreak >nul

echo.
echo ========================================================
echo  APP URLS:
echo  1. On THIS Computer:  http://localhost:8080
echo  2. On YOUR Mobile:    http://10.160.101.41:8080
echo ========================================================
echo.

echo Launching CityZen Desktop App Window...
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:8080"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:8080"
) else (
    start http://localhost:8080
)

echo App is running! Press Ctrl+C in this terminal when you want to stop.
pause
