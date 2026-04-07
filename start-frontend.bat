@echo off
REM ===========================================================
REM Nanotera SaaS - Lancement du frontend React
REM ===========================================================
REM A placer a la racine de nanotera-saas
REM Double-cliquer pour lancer Vite
REM ===========================================================

cd /d "%~dp0"

echo.
echo ====================================
echo  Nanotera Frontend (Vite)
echo ====================================
echo  URL : http://localhost:5173
echo ====================================
echo.

REM Liberer le port 5173 si occupe
call npx kill-port 5173 2>nul

npm run dev

pause
