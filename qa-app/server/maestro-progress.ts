/** Interpreta linhas do stdout do Maestro para o painel de progresso. */

const FLOW_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /ensure_login_screen/i, label: "Porto seguro (tela ENTRAR)" },
  { match: /login_phjesus/i, label: "Login PHJESUS" },
  { match: /login_etmenezes/i, label: "Login ETMENEZES" },
  { match: /login_as/i, label: "Autenticando…" },
  { match: /ensure_logged_out|logout/i, label: "Logout → ENTRAR" },
  { match: /garantir_perfil_coordenador/i, label: "Garantir perfil Coordenador" },
  { match: /garantir_perfil_professor/i, label: "Garantir perfil Professor" },
  { match: /abrir_tela_perfil|selecionar_funcao|verificar_perfil/i, label: "Tela Perfil" },
  { match: /navegar_mural/i, label: "Abrir Mural" },
  { match: /abrir_novo_comunicado/i, label: "Novo comunicado (BoomMenu)" },
  { match: /selecionar_turmas/i, label: "Selecionar turmas" },
  { match: /escrever_comunicado/i, label: "Escrever comunicado" },
  { match: /enviar_comunicado/i, label: "Enviar comunicado" },
  { match: /01_1_comunicado_enviar/i, label: "CT — enviar comunicado" },
];

export function labelForFlowPath(flowPath: string): string {
  const base = flowPath.replace(/\\/g, "/").split("/").pop() ?? flowPath;
  for (const h of FLOW_LABELS) {
    if (h.match.test(base)) return h.label;
  }
  return base.replace(/\.ya?ml$/i, "").replace(/_/g, " ");
}

export function interpretMaestroLine(line: string): {
  phase?: string;
  action?: string;
  status?: "running" | "ok" | "fail";
} | null {
  const t = line.trim();
  if (!t || t.startsWith("===") || t.includes("Debug tests faster")) return null;

  const run = /^Run\s+(.+?)(?:\.\.\.\s*(COMPLETED|FAILED))?\s*$/i.exec(t);
  if (run) {
    const flow = run[1].trim().replace(/\\/g, "/");
    const st = run[2]?.toUpperCase();
    return {
      phase: labelForFlowPath(flow),
      action: flow.split("/").pop(),
      status: st === "FAILED" ? "fail" : st === "COMPLETED" ? "ok" : "running",
    };
  }

  const step = /^(.*?)\.\.\.\s*(COMPLETED|FAILED|WARNED)\s*$/i.exec(t);
  if (step && !/^Run\s+/i.test(step[1])) {
    const st = step[2].toUpperCase();
    return {
      action: step[1].trim(),
      status: st === "FAILED" ? "fail" : st === "COMPLETED" ? "ok" : "running",
    };
  }

  if (/Element not found|Assertion is false|credenciais/i.test(t)) {
    return { action: t.slice(0, 160), status: "fail" };
  }

  return null;
}

/** Quebra chunks em linhas completas (buffer residual). */
export function createLineSplitter(onLine: (line: string) => void) {
  let buf = "";
  return {
    push(chunk: string) {
      buf += chunk.replace(/\r\n/g, "\n");
      const parts = buf.split("\n");
      buf = parts.pop() ?? "";
      for (const line of parts) onLine(line);
    },
    flush() {
      if (buf.trim()) onLine(buf);
      buf = "";
    },
  };
}
