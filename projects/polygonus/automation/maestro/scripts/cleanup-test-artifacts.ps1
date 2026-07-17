# Wrapper PowerShell — limpeza de artefatos Maestro + cópias no emulador
param(
  [switch]$Emulator,
  [switch]$DryRun,
  [int]$PruneDays = 0,
  [string]$Device = ""
)

$root = Split-Path $PSScriptRoot -Parent
$script = Join-Path $PSScriptRoot "cleanup-test-artifacts.mjs"
$args = @()

if ($Emulator) { $args += "--emulator" }
if ($DryRun) { $args += "--dry-run" }
if ($PruneDays -gt 0) { $args += "--prune-days", "$PruneDays" }
if ($Device) { $args += "--device", $Device }

Push-Location $root
try {
  node $script @args
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
