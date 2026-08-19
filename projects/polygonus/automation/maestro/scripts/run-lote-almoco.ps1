# Lote almoço: comunicados → rotinas → fale conosco. Continua se falhar.
$ErrorActionPreference = "Continue"
$maestroRoot = Split-Path $PSScriptRoot -Parent
$maestro = "C:\maestro\bin\maestro.bat"
$log = Join-Path $maestroRoot ".maestro-output\lote-almoco-2026-08-13.txt"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null

function Sync-Clock {
  $uptime = (adb shell cat /proc/uptime).Split(" ")[0]
  $elapsedMs = [int]([double]$uptime * 1000)
  $unixMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  adb shell settings put global auto_time_zone 0 | Out-Null
  adb shell settings put global auto_time 0 | Out-Null
  adb shell settings put global time_zone America/Sao_Paulo | Out-Null
  adb shell settings put system time_12_24 24 | Out-Null
  adb shell settings put secure time_12_24 24 | Out-Null
  adb shell service call alarm 3 s16 America/Sao_Paulo 2>$null | Out-Null
  adb shell cmd time_detector set_auto_detection_enabled false 2>$null | Out-Null
  adb shell cmd time_detector set_time_state_for_tests --elapsed_realtime $elapsedMs --unix_epoch_time $unixMs --user_should_confirm_time false 2>$null | Out-Null
  adb shell input keyevent KEYCODE_WAKEUP | Out-Null
  $now = (adb shell date | Out-String).Trim()
  Add-Content $log "CLOCK $now"
  Write-Host "CLOCK $now"
}

function Copy-Env {
  $src = Join-Path $maestroRoot "flows\.env"
  $dirs = @(
    "mural", "rotina", "chat",
    "shared\auth", "shared\mural", "shared\nav", "shared\chat",
    "shared\perfil", "shared\rotina"
  )
  foreach ($d in $dirs) {
    $dest = Join-Path $maestroRoot "flows\$d"
    if (Test-Path $dest) { Copy-Item $src (Join-Path $dest ".env") -Force }
  }
}

function Get-MaestroEArgs {
  $envFile = Join-Path $maestroRoot "flows\.env"
  $eArgs = @()
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or $line -notmatch "=") { return }
    $eq = $line.IndexOf("=")
    $k = $line.Substring(0, $eq).Trim()
    $v = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
    if (-not $k -or -not $v) { return }
    if ($v -notmatch "\s") { $eArgs += @("-e", "$k=$v") }
  }
  return $eArgs
}

function Get-FailHint([string]$out) {
  $lines = $out -split "`r?`n"
  $failed = $lines | Where-Object { $_ -match "FAILED" }
  $assert = $lines | Where-Object { $_ -match "Assertion is false:|Element not found:" }
  $hint = @()
  if ($failed) { $hint += ($failed | Select-Object -Last 3 | ForEach-Object { $_.Trim() }) }
  if ($assert) { $hint += ($assert | Select-Object -Last 2 | ForEach-Object { $_.Trim() }) }
  if (-not $hint) { return "(sem linha FAILED no stdout)" }
  return ($hint -join " | ")
}

$comunicados = @(
  "flows/mural/01_1_comunicado_enviar.yaml",
  "flows/mural/01_1_comunicado_editar.yaml",
  "flows/mural/01_1_comunicado_excluir.yaml",
  "flows/mural/01_1_comunicado_enquete.yaml",
  "flows/mural/01_1_comunicado_foto_galeria.yaml",
  "flows/mural/01_1_comunicado_pdf.yaml",
  "flows/mural/01_1_comunicado_video_pequeno.yaml",
  "flows/mural/01_1_comunicado_evento.yaml",
  "flows/mural/01_1_filtro_enviadas.yaml",
  "flows/mural/01_1_comunicado_completo_e2e.yaml"
)
$rotinas = @(
  "flows/rotina/01_2_1_rotina_alimentacao.yaml",
  "flows/rotina/01_2_1_rotina_banheiro.yaml",
  "flows/rotina/01_2_1_rotina_soneca.yaml",
  "flows/rotina/01_2_4_bilhete_enviar.yaml",
  "flows/rotina/01_2_1_rotina_humor.yaml",
  "flows/rotina/01_2_1_rotina_vestuario.yaml",
  "flows/rotina/01_2_3_momentos_enviar.yaml",
  "flows/rotina/01_2_2_ocorrencia_enviar.yaml"
)
$chat = @(
  "flows/chat/06_0_chat_smoke_abrir.yaml",
  "flows/chat/06_1_chat_texto.yaml",
  "flows/chat/06_1_chat_audio.yaml",
  "flows/chat/06_1_chat_pdf.yaml",
  "flows/chat/06_1_chat_video.yaml"
)

"" | Set-Content $log -Encoding UTF8
Add-Content $log "LOTE $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Copy-Env
$eArgs = Get-MaestroEArgs
Set-Location $maestroRoot

$i = 0
$all = @(
  @{ Name = "COMUNICADOS"; Flows = $comunicados },
  @{ Name = "ROTINAS"; Flows = $rotinas },
  @{ Name = "FALE_CONOSCO"; Flows = $chat }
)

foreach ($mod in $all) {
  Sync-Clock
  $header = "`n===== $($mod.Name) ====="
  Write-Host $header
  Add-Content $log $header
  foreach ($f in $mod.Flows) {
    $i++
    $n = $comunicados.Count + $rotinas.Count + $chat.Count
    Write-Host "`n========== [$i/$n] $f =========="
    Add-Content $log "`n========== [$i/$n] $f =========="
    $extra = @()
    if ($i -gt 1) { $extra = @("--no-reinstall-driver") }
    $outFile = Join-Path $maestroRoot ".maestro-output\last-flow.txt"
    & $maestro test @eArgs $f @extra --test-output-dir ".maestro-output" --udid emulator-5554 *> $outFile
    $code = $LASTEXITCODE
    $out = Get-Content $outFile -Raw -ErrorAction SilentlyContinue
    if ($code -eq 0) {
      $line = "PASS $f"
    } else {
      $hint = Get-FailHint $out
      $line = "FAIL $f | $hint"
    }
    Write-Host $line
    Add-Content $log $line
  }
}

Add-Content $log "`n===== FIM $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====="
Write-Host "`n===== FIM ====="
Get-Content $log
