@echo off
chcp 65001 >nul
echo ========================================
echo   Prospection SEO - Alti-Web
echo ========================================
echo.

cd /d "%~dp0"

python prospection_seo.py

echo.
echo ========================================
echo   Script terminé
echo ========================================
pause
