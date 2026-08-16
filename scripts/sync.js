import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDist = path.join(__dirname, '..', 'dist');
const userProfile = process.env.USERPROFILE || '';
const destApp = path.join(userProfile, 'OneDrive', 'Desktop', 'CityZen App');

if (!fs.existsSync(srcDist)) {
  console.error('Error: dist folder not found. Run "npm run build" first.');
  process.exit(1);
}

if (!fs.existsSync(destApp)) {
  fs.mkdirSync(destApp, { recursive: true });
}

console.log(`Syncing from ${srcDist} to ${destApp} ...`);
fs.cpSync(srcDist, destApp, { recursive: true, force: true });

// Ensure start-app.bat exists
const batPath = path.join(destApp, 'start-app.bat');
const batContent = `@echo off
title CityZen Smart City App
echo ========================================================
echo       CITY ZEN - One City. One App. (Bhubaneswar)
echo           Cross-Platform Desktop & Mobile App
echo ========================================================
echo.
echo Starting local app server on port 8080 ...

start /min cmd /c "python -m http.server 8080 --directory \"%~dp0\""

timeout /t 1 /nobreak >nul

echo.
echo ========================================================
echo  APP URLS:
echo  1. On THIS Computer:  http://localhost:8080
echo  2. On YOUR Mobile:    http://10.160.101.41:8080
echo ========================================================
echo.

echo Launching CityZen Desktop App Window...
if exist "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" (
    start "" "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --app="http://localhost:8080"
) else if exist "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" (
    start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --app="http://localhost:8080"
) else (
    start http://localhost:8080
)

echo App is running! Press Ctrl+C in this terminal when you want to stop.
pause`;

fs.writeFileSync(batPath, batContent, 'utf-8');
console.log('⚡ Successfully updated & synced latest web version to Desktop App!');
