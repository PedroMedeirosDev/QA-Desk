# Run one Rotina Maestro flow with flows/.env injected as -e
param(
  [Parameter(Mandatory = $true)]
  [string]$FlowRel
)

$ErrorActionPreference = "Stop"
$maestroRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $maestroRoot "config.yaml"))) {
  throw "Nao achei config.yaml em '$maestroRoot'. Rode este script a partir de projects/polygonus/automation/maestro/scripts."
}
Set-Location $maestroRoot

$envPath = Join-Path $maestroRoot "flows\.env"
$eArgs = @()
Get-Content $envPath | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) { return }
  $k = $line.Substring(0, $eq).Trim()
  $v = $line.Substring($eq + 1).Trim().Trim('"')
  $eArgs += @("-e", "$k=$v")
}

Write-Host "cwd=$maestroRoot"
Write-Host "flow=$FlowRel"
& maestro test @eArgs $FlowRel
exit $LASTEXITCODE
