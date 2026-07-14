# Sincroniza clones locais do codigo da empresa (somente leitura neste projeto QA).
# Mapa de repos: scripts/company-repos.json (papel de cada repo — Moacir)
#
# Uso: .\scripts\sync-company-repos.ps1
#      .\scripts\sync-company-repos.ps1 -Only mobile
#      .\scripts\sync-company-repos.ps1 -Only frontend   # mobile + react
#      .\scripts\sync-company-repos.ps1 -Hard

param(
    [ValidateSet("all", "mobile", "react", "go", "acropoly", "server", "frontend", "backend")]
    [string]$Only = "all",
    [switch]$Hard
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir "company-repos.json"

if (-not (Test-Path $ConfigPath)) {
    throw "Arquivo nao encontrado: $ConfigPath"
}

$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$Repos = @($config.repos)

function Test-RepoSelected {
    param([string]$Id)
    switch ($Only) {
        "all" { return $true }
        "frontend" { return $Id -in @("mobile", "react") }
        "backend" { return $Id -in @("go", "acropoly", "server") }
        default { return $Id -eq $Only }
    }
}

function Sync-Repo {
    param(
        [PSCustomObject]$Repo,
        [string]$ProjectRoot,
        [bool]$DiscardLocal
    )

    $target = Join-Path $ProjectRoot $Repo.name
    Write-Host ""
    Write-Host "==> $($Repo.name) [$($Repo.papel)]" -ForegroundColor Cyan

    if (-not (Test-Path $target)) {
        Write-Host "    Clonando $($Repo.url) (branch $($Repo.branch)) ..."
        git clone --branch $Repo.branch $Repo.url $target
        if ($LASTEXITCODE -ne 0) { throw "Falha ao clonar $($Repo.name)" }
        return
    }

    if (-not (Test-Path (Join-Path $target ".git"))) {
        throw "A pasta '$target' existe mas nao e um repositorio git. Remova ou renomeie manualmente."
    }

    Push-Location $target
    try {
        git fetch origin $Repo.branch
        if ($LASTEXITCODE -ne 0) { throw "Falha no fetch de $($Repo.name)" }

        $dirty = git status --porcelain
        if ($dirty) {
            if ($DiscardLocal) {
                Write-Warning "    Alteracoes locais serao descartadas (-Hard)."
                git reset --hard "origin/$($Repo.branch)"
                git clean -fd
            } else {
                Write-Host "    AVISO: ha alteracoes locais em $($Repo.name). Nao atualizei." -ForegroundColor Yellow
                git status -sb
                Write-Host "    Rode com -Hard para descartar ou reverta manualmente no clone." -ForegroundColor Yellow
                return
            }
        } else {
            $currentBranch = git branch --show-current
            if ($currentBranch -ne $Repo.branch) {
                git checkout $Repo.branch
                if ($LASTEXITCODE -ne 0) { throw "Falha ao trocar branch em $($Repo.name)" }
            }
            git pull --ff-only origin $Repo.branch
            if ($LASTEXITCODE -ne 0) { throw "Falha no pull de $($Repo.name)" }
        }

        $commit = git log -1 --oneline
        Write-Host "    OK: $commit" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

Write-Host "QA Automate - sincronizar codigo da empresa" -ForegroundColor White
Write-Host "Raiz: $Root"
Write-Host "Mapa: company-repos.json (Moacir)"

foreach ($repo in $Repos) {
    if (Test-RepoSelected -Id $repo.id) {
        Sync-Repo -Repo $repo -ProjectRoot $Root -DiscardLocal:$Hard.IsPresent
    }
}

Write-Host ""
Write-Host "Concluido." -ForegroundColor Green
