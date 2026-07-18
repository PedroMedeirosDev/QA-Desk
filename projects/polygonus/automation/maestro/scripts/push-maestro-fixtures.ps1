# Empurra PDF/video para /sdcard/Download (picker do clipe).
# Uso: .\scripts\push-maestro-fixtures.ps1
#      .\scripts\push-maestro-fixtures.ps1 -Device emulator-5554

param(
  [string]$Device = "emulator-5554"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Fixtures = Join-Path $Root "fixtures"

$files = @(
  "PDF_TESTE.pdf",
  "PDF TESTE.pdf",
  "Video_teste.mp4"
)

Write-Host "Device: $Device"
Write-Host "Fixtures: $Fixtures"

adb -s $Device shell mkdir -p /sdcard/Download | Out-Null

foreach ($name in $files) {
  $src = Join-Path $Fixtures $name
  if (-not (Test-Path -LiteralPath $src)) {
    throw "Fixture ausente: $src"
  }
  Write-Host "adb push -> /sdcard/Download/$name"
  adb -s $Device push $src "/sdcard/Download/$name"
  if ($LASTEXITCODE -ne 0) { throw "adb push falhou: $name" }
}

Write-Host ""
Write-Host "Conteudo /sdcard/Download (PDF/Video):"
adb -s $Device shell "ls -la /sdcard/Download/" | Select-String -Pattern "PDF|Video|TESTE|teste"
Write-Host "OK - fixtures no device."
