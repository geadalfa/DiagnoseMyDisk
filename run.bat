@echo off
title DiagnoseMyDisk - Smart Disk Health & Diagnostics
cd /d "%~dp0"
echo ========================================================
echo    DiagnoseMyDisk - Smart Disk Health & Diagnostics
echo ========================================================
echo Memulai server lokal di http://localhost:5550 ...
echo Jendela aplikasi akan terbuka secara otomatis.
echo.
python server.py
pause
