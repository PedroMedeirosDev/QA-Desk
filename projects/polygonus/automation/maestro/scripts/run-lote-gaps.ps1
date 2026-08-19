# Lote gaps: rotina → fale conosco → comunicados.
# Injeta TODO o flows/.env (inclui valores com espaço: TURMA_ROTINA, NOME_PHJESUS).
# Continua se falhar. Log em .maestro-output/lote-gaps-*.txt

$ErrorActionPreference = "Continue"
$maestroRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $maestroRoot "config.yaml"))) {
  $maestroRoot = "c:\Users\pedro\Projetos Portfolio\Qa Desk\projects\polygonus\automation\maestro"
}
$maestro = "C:\maestro\bin\maestro.bat"
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$log = Join-Path $maestroRoot ".maestro-output\lote-gaps-$stamp.txt"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null

function Sync-Clock {
  $uptime = (adb shell cat /proc/uptime).Split(" ")[0]
  $elapsedMs = [int]([double]$uptime * 1000)
  $unixMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  adb shell settings put global auto_time_zone 0 | Out-Null
  adb shell settings put global auto_time 0 | Out-Null
  adb shell settings put global time_zone America/Sao_Paulo | Out-Null
  adb shell cmd time_detector set_auto_detection_enabled false 2>$null | Out-Null
  adb shell cmd time_detector set_time_state_for_tests --elapsed_realtime $elapsedMs --unix_epoch_time $unixMs --user_should_confirm_time false 2>$null | Out-Null
  adb shell input keyevent KEYCODE_WAKEUP | Out-Null
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
  # Igual run-rotina-flow.ps1: inclui valores com espaço (array, sem shell:true)
  $envFile = Join-Path $maestroRoot "flows\.env"
  $eArgs = @()
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $k = $line.Substring(0, $eq).Trim()
    $v = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
    if (-not $k -or $v -eq "") { return }
    $eArgs += @("-e", "${k}=${v}")
  }
  return $eArgs
}

function Get-FailHint([string]$out) {
  if (-not $out) { return "(stdout vazio)" }
  $lines = $out -split "`r?`n"
  $failed = $lines | Where-Object { $_ -match "FAILED" }
  $assert = $lines | Where-Object { $_ -match "Assertion is false:|Element not found:|Timeout|DEADLINE_EXCEEDED|StatusRuntimeException" }
  $hint = @()
  if ($failed) { $hint += ($failed | Select-Object -Last 3 | ForEach-Object { $_.Trim() }) }
  if ($assert) { $hint += ($assert | Select-Object -Last 2 | ForEach-Object { $_.Trim() }) }
  if (-not $hint) {
    $tail = ($lines | Where-Object { $_.Trim() } | Select-Object -Last 3 | ForEach-Object { $_.Trim() })
    if ($tail) { return ($tail -join " | ") }
    return "(sem linha FAILED no stdout)"
  }
  return ($hint -join " | ")
}

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

"" | Set-Content $log -Encoding UTF8
Add-Content $log "LOTE GAPS $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ordem=rotina,chat,comunicados env=full"
Copy-Env
$eArgs = @(Get-MaestroEArgs)
Write-Host "eArgs count=$($eArgs.Count / 2) LOG=$log"
Set-Location $maestroRoot

$i = 0
$all = @(
  @{ Name = "ROTINAS"; Flows = $rotinas },
  @{ Name = "FALE_CONOSCO"; Flows = $chat },
  @{ Name = "COMUNICADOS"; Flows = $comunicados }
)
$total = $rotinas.Count + $chat.Count + $comunicados.Count

foreach ($mod in $all) {
  Sync-Clock
  $header = "`n===== $($mod.Name) ====="
  Write-Host $header
  Add-Content $log $header
  foreach ($f in $mod.Flows) {
    $i++
    Write-Host "`n========== [$i/$total] $f =========="
    Add-Content $log "`n========== [$i/$total] $f =========="
    $maestroArgs = @("test") + $eArgs
    # Sempre reinstala driver — --no-reinstall-driver falhava com DEADLINE no eraseText
    $maestroArgs += @("--test-output-dir", ".maestro-output", "--udid", "emulator-5554", $f)
    $outFile = Join-Path $maestroRoot ".maestro-output\last-flow-$i.txt"
    Remove-Item $outFile -Force -ErrorAction SilentlyContinue
    # Call operator (não Start-Process): preserva -e "NOME_PHJESUS=Pedro Jesus"
    & $maestro @maestroArgs *> $outFile
    $code = $LASTEXITCODE
    $out = ""
    if (Test-Path $outFile) { $out = Get-Content $outFile -Raw -ErrorAction SilentlyContinue }
    if ($code -eq 0) { $line = "PASS $f" }
    else {
      $hint = Get-FailHint $out
      $line = "FAIL $f | $hint"
      if ($out -match "DEADLINE_EXCEEDED|AndroidDriverTimeout|driver did not start") {
        adb -s emulator-5554 shell am force-stop br.com.polygonus.mobile.amostra | Out-Null
        Start-Sleep 3
      }
    }
    Write-Host $line
    Add-Content $log $line
  }
}

Add-Content $log "`n===== FIM $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====="
Write-Host "`n===== FIM ====="
Write-Host "LOG=$log"
Get-Content $log
