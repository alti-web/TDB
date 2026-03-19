@echo off
chcp 65001 >nul 2>&1
title Compilation Alti-Board Installer

echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║  Compilation de l'installeur Alti-Board   ║
echo  ╚═══════════════════════════════════════════╝
echo.

:: Vérifier si ps2exe est installé
powershell -NoProfile -Command "if (-not (Get-Module -ListAvailable ps2exe)) { Write-Host 'Installation de ps2exe...' -ForegroundColor Yellow; Install-Module ps2exe -Scope CurrentUser -Force }"

echo.
echo  Compilation en cours...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Invoke-ps2exe -InputFile 'Install-AltiBoard.ps1' -OutputFile 'Install-AltiBoard.exe' -NoConsole -Title 'Alti-Board Installer' -Description 'Installeur du tableau de bord Alti-Board' -Company 'Alti-Web SEO' -Product 'Alti-Board' -Version '1.0.0.0' -IconFile 'alti-board.ico' -RequireAdmin $false"

echo.
if exist "Install-AltiBoard.exe" (
    echo  ✅ Compilation réussie !
    echo  Le fichier "Install-AltiBoard.exe" est prêt.
    echo.
    echo  Pour l'envoyer à vos clients, envoyez :
    echo    - Install-AltiBoard.exe
    echo    - alti-board.ico (doit être dans le même dossier)
    echo.
    echo  Ou créez un ZIP avec les deux fichiers.
) else (
    echo  ❌ Erreur de compilation.
    echo  Utilisez le fichier .bat comme alternative.
)

echo.
pause
