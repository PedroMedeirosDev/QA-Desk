@echo off
REM Atualiza clones polygonus-br (mapa Moacir — ver scripts/company-repos.json)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sync-company-repos.ps1" %*
