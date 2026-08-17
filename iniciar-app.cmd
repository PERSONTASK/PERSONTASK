@echo off
title PERSONTASK - servidor local
cd /d "%~dp0"
echo ================================================
echo   PERSONTASK - iniciando o servidor local...
echo.
echo   O navegador abre sozinho em alguns segundos.
echo   MANTENHA ESTA JANELA ABERTA enquanto usa o app.
echo   Para PARAR: feche esta janela.
echo ================================================
echo.
start "" /min powershell -NoProfile -Command "Start-Sleep 6; Start-Process 'http://localhost:5173'"
npm run dev
