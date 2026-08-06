@echo off
title QA Desk — Agente
cd /d "%~dp0"
echo.
echo  QA Desk — Agente remoto
echo  API: usa QA_DESK_URL + QA_AGENT_TOKEN do .env
echo  Deixe esta janela aberta enquanto roda testes no live.
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo [erro] Node.js nao encontrado no PATH.
  pause
  exit /b 1
)
call npm run agent
echo.
echo Agente encerrou. Pressione qualquer tecla para fechar.
pause >nul
