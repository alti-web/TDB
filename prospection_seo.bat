@echo off
chcp 65001 >nul
echo ========================================
echo   Prospection SEO - Alti-Web
echo ========================================
echo.

cd /d "%~dp0"

pip install python-dotenv selenium requests >nul 2>&1

python prospection_seo.py

echo.
echo ========================================
echo   Script terminé
echo   Le fichier log .txt a été généré
echo   dans le dossier : %~dp0
echo ========================================
pause
