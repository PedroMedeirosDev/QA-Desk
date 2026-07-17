# Fixa fuso do emulador Android em America/Sao_Paulo (GMT-3).
# Uso: .\scripts\emulator-timezone-br.ps1
#      .\scripts\emulator-timezone-br.ps1 -Device emulator-5554
#
# Nota: não corrige datEnvio gravado errado no servidor — só o relógio do device.

param(
  [string]$Device = "emulator-5554",
  [string]$Timezone = "America/Sao_Paulo"
)

$ErrorActionPreference = "Stop"

function Invoke-Adb([string[]]$AdbArgs) {
  & adb -s $Device @AdbArgs
  if ($LASTEXITCODE -ne 0) { throw "adb falhou: adb -s $Device $($AdbArgs -join ' ')" }
}

Write-Host "Device: $Device"
Write-Host "Timezone alvo: $Timezone"

Invoke-Adb @("shell", "settings", "put", "global", "auto_time_zone", "0")
Invoke-Adb @("shell", "settings", "put", "global", "auto_time", "0")
Invoke-Adb @("shell", "settings", "put", "global", "time_zone", $Timezone)
Invoke-Adb @("shell", "settings", "put", "system", "time_zone", $Timezone)

# Em builds de produção setprop costuma falhar — não aborta
$setpropOk = $true
try {
  Invoke-Adb @("shell", "setprop", "persist.sys.timezone", $Timezone)
} catch {
  $setpropOk = $false
  Write-Warning "setprop persist.sys.timezone falhou (normal em emulador user) — usando settings global."
}

Invoke-Adb @("shell", "service", "call", "alarm", "3", "s16", $Timezone) 2>$null

$tz = ((adb -s $Device shell getprop persist.sys.timezone) | Out-String).Trim()
$globalTz = ((adb -s $Device shell settings get global time_zone) | Out-String).Trim()
$auto = ((adb -s $Device shell settings get global auto_time_zone) | Out-String).Trim()
$now = ((adb -s $Device shell date) | Out-String).Trim()

Write-Host ""
Write-Host "persist.sys.timezone = $tz"
Write-Host "global.time_zone     = $globalTz"
Write-Host "auto_time_zone       = $auto"
Write-Host "date                 = $now"

if ($globalTz.Trim() -ne $Timezone) {
  Write-Warning "Timezone não aplicou — reinicie o emulador com: emulator -avd Medium_Phone -timezone America/Sao_Paulo"
  exit 1
}

Write-Host ""
if ($setpropOk -and $tz.Trim() -eq $Timezone) {
  Write-Host "OK — emulador em GMT-3 (persist + settings)."
} else {
  Write-Host "OK — time_zone em settings ($Timezone). Se o relógio da barra ainda estiver errado, cold boot com -timezone."
}
