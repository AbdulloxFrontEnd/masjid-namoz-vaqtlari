@echo off
chcp 65001 >nul
title Masjidlar va Namoz Vaqtlari - Ommaviy Vaqtinchalik Server
cls
echo ========================================================
echo   MASJIDLAR VA NAMOZ VAQTLARI - VAQTINCHALIK SERVER
echo ========================================================
echo 1. Mahalliy server tekshirilmoqda...

tasklist /FI "IMAGENAME eq python.exe" 2>NUL | find /I /N "python.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo Mahalliy server ishga tushirilmoqda...
    start /B python server.py 8080
    timeout /t 2 >nul
)

echo 2. Cloudflare orqali butun dunyo uchun ommaviy HTTPS havola yaratilmoqda...
echo.
cloudflared tunnel --url http://localhost:8080
pause
