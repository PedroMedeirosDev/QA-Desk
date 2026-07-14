# Sincroniza eventos GitHub → projects/polygonus/homologacao/inbox/latest.md
# Requer: Node 18+ e gh auth login (ou GITHUB_TOKEN no .env)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

node "$PSScriptRoot/sync-github-homologacao.mjs" @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Abra no Cursor: projects/polygonus/homologacao/inbox/latest.md" -ForegroundColor Cyan
Write-Host "Ou pergunte: 'Leia inbox/latest.md e monte meu plano de homologacao'" -ForegroundColor Cyan
