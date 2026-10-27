// API dos testes (modo mock, porta 3011). Por padrão os dados ficam isolados em
// e2e/.dados, apagados a cada subida: nenhum teste grava nos projetos reais.
// QA_E2E_DADOS_REAIS=1 usa data/ (specs @local, que dependem dos dados de verdade).
import { rmSync } from "node:fs";
import { spawn } from "node:child_process";
import process from "node:process";

const env = {
  ...process.env,
  DATABASE_URL: "",
  QA_APP_PORT: "3011",
  QA_AUTOMATION_RUN: "0",
  QA_E2E_MOCK: "1",
};

if (process.env.QA_E2E_DADOS_REAIS !== "1") {
  rmSync("e2e/.dados", { recursive: true, force: true });
  env.QA_DATA_DIR = "e2e/.dados";
}

const api = spawn("npx", ["tsx", "server/index.ts"], { env, stdio: "inherit", shell: true });
api.on("exit", (code) => process.exit(code ?? 0));
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => api.kill(sinal));
