# Finaliza rename qa-app → qa-desk
# Rode com o Cursor FECHADO nesta pasta (ou sem arquivos de qa-app abertos),
# senão o Windows trava o rename.
#
# Uso (PowerShell na raiz do repo):
#   .\scripts\finalize-qa-desk-rename.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Repo: $root"

$junction = Join-Path $root "qa-desk"
$source = Join-Path $root "qa-app"

if (-not (Test-Path $source)) {
  if ((Test-Path $junction) -and -not (Get-Item $junction).Attributes.ToString().Contains("ReparsePoint")) {
    Write-Host "OK: pasta real ja e qa-desk."
    exit 0
  }
  Write-Error "qa-app nao encontrado."
}

# Remove junction qa-desk se existir
if (Test-Path $junction) {
  $item = Get-Item $junction -Force
  if ($item.Attributes.ToString().Contains("ReparsePoint")) {
    Write-Host "Removendo junction qa-desk..."
    cmd /c "rmdir `"$junction`""
  } else {
    Write-Error "qa-desk ja existe como pasta real. Abortando."
  }
}

Write-Host "Renomeando qa-app -> qa-desk..."
Rename-Item -LiteralPath $source -NewName "qa-desk"
Write-Host "Pronto. Abra o Cursor em: $root"
Write-Host "Depois: cd qa-desk; npm install (se necessario)"
