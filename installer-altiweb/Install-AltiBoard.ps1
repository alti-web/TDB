# ═══════════════════════════════════════════════════════
#  Installeur Alti-Board - Tableau de bord client SEO
#  Double-cliquez pour installer l'icône sur votre bureau
# ═══════════════════════════════════════════════════════

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ─── Configuration ───
$appName = "Alti-Board"
$appUrl = "https://alti-board.fr/"
$appDescription = "Tableau de bord client Alti-Web SEO"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "$appName.lnk"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconPath = Join-Path $scriptDir "alti-board.ico"

# ─── Vérifier si déjà installé ───
if (Test-Path $shortcutPath) {
    [System.Windows.Forms.MessageBox]::Show(
        "$appName est déjà installé sur votre bureau !`n`nDouble-cliquez sur l'icône pour y accéder.",
        "$appName",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    )
    exit
}

# ─── Créer la fenêtre d'installation ───
$form = New-Object System.Windows.Forms.Form
$form.Text = "Installation $appName"
$form.Size = New-Object System.Drawing.Size(460, 340)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(19, 24, 37)
$form.ForeColor = [System.Drawing.Color]::FromArgb(232, 236, 244)
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

# Icône de la fenêtre
if (Test-Path $iconPath) {
    $form.Icon = New-Object System.Drawing.Icon($iconPath)
}

# ─── Titre ───
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "Alti-Board"
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = [System.Drawing.Color]::FromArgb(79, 140, 255)
$titleLabel.AutoSize = $true
$titleLabel.Location = New-Object System.Drawing.Point(30, 25)
$form.Controls.Add($titleLabel)

# ─── Sous-titre ───
$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = "Tableau de bord client SEO"
$subtitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$subtitleLabel.ForeColor = [System.Drawing.Color]::FromArgb(136, 146, 168)
$subtitleLabel.AutoSize = $true
$subtitleLabel.Location = New-Object System.Drawing.Point(32, 65)
$form.Controls.Add($subtitleLabel)

# ─── Séparateur ───
$separator = New-Object System.Windows.Forms.Label
$separator.BorderStyle = "Fixed3D"
$separator.Size = New-Object System.Drawing.Size(400, 2)
$separator.Location = New-Object System.Drawing.Point(30, 95)
$form.Controls.Add($separator)

# ─── Description ───
$descLabel = New-Object System.Windows.Forms.Label
$descLabel.Text = "Ce programme va installer un raccourci sur votre bureau pour accéder rapidement à votre tableau de bord Alti-Board."
$descLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$descLabel.ForeColor = [System.Drawing.Color]::FromArgb(200, 205, 215)
$descLabel.Size = New-Object System.Drawing.Size(400, 50)
$descLabel.Location = New-Object System.Drawing.Point(30, 110)
$form.Controls.Add($descLabel)

# ─── Info ───
$infoLabel = New-Object System.Windows.Forms.Label
$infoLabel.Text = "L'icône apparaîtra sur votre bureau.`nDouble-cliquez dessus pour ouvrir votre espace client."
$infoLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$infoLabel.ForeColor = [System.Drawing.Color]::FromArgb(52, 211, 153)
$infoLabel.Size = New-Object System.Drawing.Size(400, 45)
$infoLabel.Location = New-Object System.Drawing.Point(30, 170)
$form.Controls.Add($infoLabel)

# ─── Bouton Installer ───
$installBtn = New-Object System.Windows.Forms.Button
$installBtn.Text = "Installer"
$installBtn.Size = New-Object System.Drawing.Size(180, 45)
$installBtn.Location = New-Object System.Drawing.Point(30, 235)
$installBtn.BackColor = [System.Drawing.Color]::FromArgb(79, 140, 255)
$installBtn.ForeColor = [System.Drawing.Color]::White
$installBtn.FlatStyle = "Flat"
$installBtn.FlatAppearance.BorderSize = 0
$installBtn.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$installBtn.Cursor = "Hand"
$installBtn.Add_Click({
    try {
        # Créer le raccourci
        $ws = New-Object -ComObject WScript.Shell
        $sc = $ws.CreateShortcut($shortcutPath)
        $sc.TargetPath = $appUrl
        $sc.Description = $appDescription
        if (Test-Path $iconPath) {
            # Copier l'icône dans un dossier permanent
            $appDataDir = Join-Path $env:APPDATA "AltiBoard"
            if (-not (Test-Path $appDataDir)) { New-Item -Path $appDataDir -ItemType Directory -Force | Out-Null }
            $permanentIcon = Join-Path $appDataDir "alti-board.ico"
            Copy-Item $iconPath $permanentIcon -Force
            $sc.IconLocation = "$permanentIcon,0"
        }
        $sc.Save()

        $installBtn.Text = "Installé !"
        $installBtn.BackColor = [System.Drawing.Color]::FromArgb(52, 211, 153)
        $installBtn.Enabled = $false

        $infoLabel.Text = "Installation réussie ! L'icône est sur votre bureau."
        $infoLabel.ForeColor = [System.Drawing.Color]::FromArgb(52, 211, 153)

    } catch {
        [System.Windows.Forms.MessageBox]::Show(
            "Erreur lors de l'installation : $($_.Exception.Message)",
            "Erreur",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
})
$form.Controls.Add($installBtn)

# ─── Bouton Annuler ───
$cancelBtn = New-Object System.Windows.Forms.Button
$cancelBtn.Text = "Annuler"
$cancelBtn.Size = New-Object System.Drawing.Size(120, 45)
$cancelBtn.Location = New-Object System.Drawing.Point(225, 235)
$cancelBtn.BackColor = [System.Drawing.Color]::FromArgb(30, 35, 50)
$cancelBtn.ForeColor = [System.Drawing.Color]::FromArgb(136, 146, 168)
$cancelBtn.FlatStyle = "Flat"
$cancelBtn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(60, 65, 80)
$cancelBtn.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$cancelBtn.Cursor = "Hand"
$cancelBtn.Add_Click({ $form.Close() })
$form.Controls.Add($cancelBtn)

# ─── Lancer ───
[void]$form.ShowDialog()
