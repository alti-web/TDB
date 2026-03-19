@echo off
chcp 65001 >nul 2>&1
title Installation Alti-Board

:: ─── Vérifier si déjà installé ───
if exist "%USERPROFILE%\Desktop\Alti-Board.lnk" (
    echo.
    echo   Alti-Board est déjà installé sur votre bureau !
    echo   Double-cliquez sur l'icône "Alti-Board" pour y accéder.
    echo.
    pause
    exit /b
)

:: ─── Créer le raccourci via PowerShell ───
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Alti-Board.lnk'); " ^
  "$sc.TargetPath = 'https://alti-board.fr/'; " ^
  "$sc.Description = 'Tableau de bord client Alti-Web SEO'; " ^
  "$iconPath = Join-Path $PSScriptRoot 'alti-board.ico'; " ^
  "if (Test-Path $iconPath) { $sc.IconLocation = $iconPath + ',0' }; " ^
  "$sc.Save(); " ^
  "Write-Host ''; " ^
  "Write-Host '  ✅ Alti-Board a été installé avec succès !' -ForegroundColor Green; " ^
  "Write-Host ''; " ^
  "Write-Host '  Une icône \"Alti-Board\" est maintenant sur votre bureau.' -ForegroundColor Cyan; " ^
  "Write-Host '  Double-cliquez dessus pour accéder à votre tableau de bord.' -ForegroundColor Cyan; " ^
  "Write-Host ''; "

pause
