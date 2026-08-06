# Inicia o agente QA Desk (PC atende jobs do live).
# Uso: clique direito → Executar com PowerShell
#   ou: powershell -File scripts/start-qa-agent.ps1
$ErrorActionPreference = "Stop"
$desk = Split-Path $PSScriptRoot -Parent
Set-Location $desk

$envFile = Join-Path $desk ".env"
if (-not (Test-Path $envFile)) {
  Write-Error "Falta qa-desk/.env — copie de .env.example e defina QA_AGENT_TOKEN + QA_DESK_URL."
}

$hasToken = Select-String -Path $envFile -Pattern '(?m)^QA_AGENT_TOKEN=\S+' -Quiet
$hasUrl = Select-String -Path $envFile -Pattern '(?m)^QA_DESK_URL=\S+' -Quiet
if (-not $hasToken -or -not $hasUrl) {
  Write-Error "Defina QA_AGENT_TOKEN e QA_DESK_URL no .env (mesmo token da Oracle)."
}

Write-Host "QA Desk agente — $desk" -ForegroundColor Cyan
Write-Host "Deixe esta janela aberta. No live, UserBar deve mostrar Agente: Online." -ForegroundColor DarkGray
Write-Host ""
npm run agent
