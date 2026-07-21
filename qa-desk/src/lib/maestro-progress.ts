/** Interpreta linhas do stdout do Maestro para o painel de progresso (fase/ação). */

const FLOW_LABELS: Array<{ match: RegExp; label: string }> = [
  { match: /ensure_login_screen/i, label: "Porto seguro (tela ENTRAR)" },
  { match: /resume_phjesus/i, label: "Retomar sessão PHJESUS" },
  { match: /login_phjesus/i, label: "Login PHJESUS" },
  { match: /login_etmenezes/i, label: "Login ETMENEZES" },
  { match: /login_as/i, label: "Autenticando…" },
  { match: /ensure_logged_out|logout/i, label: "Logout → ENTRAR" },
  { match: /garantir_perfil_coordenador/i, label: "Garantir perfil Coordenador" },
  { match: /garantir_perfil_professor/i, label: "Garantir perfil Professor" },
  { match: /setup_coordenador_mural/i, label: "Setup coordenador + Mural" },
  { match: /abrir_tela_perfil|selecionar_funcao|verificar_perfil/i, label: "Tela Perfil" },
  { match: /navegar_mural/i, label: "Abrir Mural" },
  { match: /publicar_comunicado/i, label: "Publicar comunicado" },
  { match: /confirmar_comunicado/i, label: "Confirmar comunicado enviado" },
  { match: /verificar_responsavel/i, label: "Validar visão responsável" },
  { match: /voltar_home/i, label: "Voltar à home" },
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

export type MaestroLineInfo = {
  phase?: string;
  action?: string;
  flowFile?: string;
  status?: "running" | "ok" | "fail" | "skipped";
};

/** Remove códigos ANSI e normaliza espaços. */
export function stripMaestroLine(line: string): string {
  return line
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\r/g, "")
    .trim();
}

export function interpretMaestroLine(raw: string): MaestroLineInfo | null {
  const t = stripMaestroLine(raw);
  if (!t || t.startsWith("===") || t.includes("Debug tests faster")) return null;

  const flowBanner = /^>\s*Flow\s+(.+)$/i.exec(t);
  if (flowBanner) {
    const name = flowBanner[1].trim();
    return {
      phase: labelForFlowPath(name),
      action: name,
      flowFile: name.includes(".") ? name : undefined,
      status: "running",
    };
  }

  const device = /^Running on\s+(.+)$/i.exec(t);
  if (device) {
    return { action: `Emulador: ${device[1].trim()}`, status: "running" };
  }

  const run = /^\s*Run\s+(.+?)(?:\.\.\.\s*(COMPLETED|FAILED|SKIPPED))?\s*$/i.exec(t);
  if (run) {
    const flow = run[1].trim().replace(/\\/g, "/");
    const file = flow.split("/").pop() ?? flow;
    const st = run[2]?.toUpperCase();
    const isYaml = /\.ya?ml$/i.test(file);
    return {
      phase: labelForFlowPath(flow),
      flowFile: isYaml ? file : undefined,
      action: isYaml ? undefined : file,
      status:
        st === "FAILED"
          ? "fail"
          : st === "COMPLETED"
            ? "ok"
            : st === "SKIPPED"
              ? "skipped"
              : "running",
    };
  }

  const step = /^\s*(.+?)\.\.\.\s*(COMPLETED|FAILED|WARNED|SKIPPED)\s*$/i.exec(t);
  if (step && !/^Run\s+/i.test(step[1].trim())) {
    const action = step[1].trim();
    const st = step[2].toUpperCase();
    return {
      action,
      status:
        st === "FAILED"
          ? "fail"
          : st === "COMPLETED"
            ? "ok"
            : st === "SKIPPED"
              ? "skipped"
              : "running",
    };
  }

  const runStart = /^\s*Run\s+(.+\.ya?ml)\.\.\.\s*$/i.exec(t);
  if (runStart) {
    const flow = runStart[1].trim().replace(/\\/g, "/");
    const file = flow.split("/").pop() ?? flow;
    return {
      phase: labelForFlowPath(flow),
      flowFile: file,
      status: "running",
    };
  }

  if (/Element not found|Assertion is false|Assertion '|Unknown Property|Flow path does not exist/i.test(t)) {
    return { action: t.slice(0, 200), status: "fail" };
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
