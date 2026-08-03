/**
 * Sobe a API E2E mock (se desk), roda Newman, encerra o server.
 * Compat: npm run test:api:postman → suite desk
 * Extra: node scripts/run-api-newman.mjs polygonus
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suiteId = process.argv[2] || "desk";
const suiteDir = path.join(root, "postman", "projects", suiteId);
const manifestPath = path.join(suiteDir, "manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error(`Suite não encontrada: ${suiteId} (${manifestPath})`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const collection = path.join(suiteDir, manifest.collection);
const environment = path.join(suiteDir, manifest.environment);
const HEALTH = "http://127.0.0.1:3011/api/health";
const isWin = process.platform === "win32";

function spawnNpm(args, opts = {}) {
  return spawn(isWin ? "npm.cmd" : "npm", args, {
    cwd: root,
    stdio: opts.stdio ?? "inherit",
    env: process.env,
    shell: isWin,
    ...opts,
  });
}

function spawnNewman(newmanArgs, opts = {}) {
  const newmanJs = path.join(root, "node_modules", "newman", "bin", "newman.js");
  return spawn(process.execPath, [newmanJs, ...newmanArgs], {
    cwd: root,
    stdio: opts.stdio ?? "inherit",
    env: process.env,
    shell: false,
  });
}

function killTree(pid) {
  if (!pid) return;
  if (isWin) {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      shell: true,
    });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* already dead */
      }
    }
  }
}

async function waitForHealth(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(HEALTH);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`API não respondeu em ${HEALTH}`);
}

function envVarArgs() {
  const map = {
    POLY_API_BASE_URL: "baseUrl",
    POLY_API_LOGIN: "login",
    POLY_API_SENHA: "senha",
    POLY_API_UNIDADE: "unidade",
    POLY_API_HOSTNAME: "hostname",
    POLY_API_ANO: "ano",
  };
  const args = [];
  for (const [proc, key] of Object.entries(map)) {
    const val = process.env[proc]?.trim();
    if (val) args.push("--env-var", `${key}=${val}`);
  }
  if (suiteId === "polygonus") {
    if (!process.env.POLY_API_BASE_URL) {
      args.push("--env-var", "baseUrl=https://amostra.polygonus.com.br/api/v2");
    }
    if (!process.env.POLY_API_LOGIN) args.push("--env-var", "login=SUPPETER");
    if (!process.env.POLY_API_UNIDADE) {
      args.push("--env-var", "unidade=Colégio Demonstração");
    }
    if (!process.env.POLY_API_SENHA && process.env.PLAYWRIGHT_SENHA) {
      args.push("--env-var", `senha=${process.env.PLAYWRIGHT_SENHA}`);
    }
  }
  return args;
}

let server;
let exitCode = 1;
try {
  if (manifest.bootMock) {
    server = spawnNpm(["run", "e2e:api"], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: !isWin,
    });
    server.stdout?.on("data", (b) => process.stdout.write(b));
    server.stderr?.on("data", (b) => process.stderr.write(b));
    await waitForHealth();
  }

  if (suiteId === "polygonus") {
    const senha =
      process.env.POLY_API_SENHA?.trim() || process.env.PLAYWRIGHT_SENHA?.trim();
    if (!senha) {
      throw new Error(
        "Defina POLY_API_SENHA ou PLAYWRIGHT_SENHA no ambiente para a suite Polygonus.",
      );
    }
  }

  const collectionArg = isWin ? `"${collection}"` : collection;
  const environmentArg = isWin ? `"${environment}"` : environment;

  exitCode = await new Promise((resolve) => {
    const newman = spawnNewman(
      ["run", collection, "-e", environment, ...envVarArgs()],
      { stdio: "inherit" },
    );
    newman.on("exit", (code) => resolve(code ?? 1));
    newman.on("error", () => resolve(1));
  });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  killTree(server?.pid);
  await new Promise((r) => setTimeout(r, 500));
}

process.exit(exitCode);
