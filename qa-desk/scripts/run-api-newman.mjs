/**
 * Sobe a API E2E mock, roda Newman, encerra o server.
 * Evita start-server-and-test + wmic.exe (quebrado em Windows recentes).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const server = spawnNpm(["run", "e2e:api"], {
  stdio: ["ignore", "pipe", "pipe"],
  detached: !isWin,
});

server.stdout?.on("data", (b) => process.stdout.write(b));
server.stderr?.on("data", (b) => process.stderr.write(b));

let exitCode = 1;
try {
  await waitForHealth();
  exitCode = await new Promise((resolve) => {
    const newman = spawnNpm(
      [
        "exec",
        "--",
        "newman",
        "run",
        "postman/qa-desk-api.postman_collection.json",
        "-e",
        "postman/local.postman_environment.json",
      ],
      { stdio: "inherit" },
    );
    newman.on("exit", (code) => resolve(code ?? 1));
    newman.on("error", () => resolve(1));
  });
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  killTree(server.pid);
  // dá um tempo pro taskkill
  await new Promise((r) => setTimeout(r, 500));
}

process.exit(exitCode);
