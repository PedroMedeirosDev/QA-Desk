import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bug, FlaskConical } from "lucide-react";
import { api } from "@/lib/api";
import { projectBugDetailPath, projectDetailPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import type { ProjectSlug, TestRecord } from "@/types/test-record";
import {
  displayStatus,
  formatRecordId,
  inferChannel,
  isBugReport,
  linkedTestIdOf,
} from "@/types/test-record";

const PANEL = "rounded-xl border border-border/70 bg-muted/20 p-4";
const PANEL_TITLE = "flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground";

function fmtData(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
}

/** No bug: o caso de teste que revelou o defeito e a execução que falhou. */
export function LinkedTestPanel({
  project,
  bug,
}: {
  project: ProjectSlug;
  bug: Pick<TestRecord, "linkedTestId" | "linkedRunAt" | "tags">;
}) {
  const testId = linkedTestIdOf(bug);
  const [test, setTest] = useState<TestRecord | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!testId) return;
    let vivo = true;
    setErro(false);
    api
      .getTest(project, testId)
      .then((t) => vivo && setTest(t))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [project, testId]);

  if (!testId) return null;
  const execucao = fmtData(bug.linkedRunAt);

  return (
    <div className={PANEL}>
      <p className={PANEL_TITLE}>
        <FlaskConical className="size-3.5" />
        Teste vinculado
      </p>
      {erro ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {formatRecordId(testId)} não está mais no catálogo.
        </p>
      ) : !test ? (
        <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="mt-2 space-y-2">
          <Link
            to={projectDetailPath(project, test.id, inferChannel(test))}
            className="block text-sm font-medium text-foreground hover:underline"
          >
            {formatRecordId(test.id, test)} · {test.title}
          </Link>
          {execucao ? (
            <p className="text-xs text-muted-foreground">Falhou na execução de {execucao}</p>
          ) : null}
          {test.scenario?.trim() ? (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-background/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
              {test.scenario.trim()}
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** No caso de teste: os bugs que ele revelou. */
export function TestBugsPanel({ project, testId }: { project: ProjectSlug; testId: string }) {
  const [bugs, setBugs] = useState<TestRecord[] | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .listTests(project)
      .then((catalog) => {
        if (!vivo) return;
        setBugs(catalog.reports.filter((r) => isBugReport(r) && linkedTestIdOf(r) === testId));
      })
      .catch(() => vivo && setBugs([]));
    return () => {
      vivo = false;
    };
  }, [project, testId]);

  if (!bugs || bugs.length === 0) return null;

  return (
    <div className={PANEL}>
      <p className={PANEL_TITLE}>
        <Bug className="size-3.5" />
        Bugs encontrados por este teste
      </p>
      <ul className="mt-2 space-y-1.5">
        {bugs.map((b) => {
          const { label, tone } = displayStatus(b);
          return (
            <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
              <Link
                to={projectBugDetailPath(project, b.id, inferChannel(b))}
                className="min-w-0 truncate hover:underline"
              >
                <span className="font-mono text-xs text-muted-foreground">{formatRecordId(b.id, b)}</span>{" "}
                {b.title}
              </Link>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem]",
                  tone === "ok" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400",
                  tone === "warn" && "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300",
                  tone === "fail" && "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300",
                  tone === "neutral" && "border-border bg-muted text-foreground",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Modelo inicial do cenário, montado com o que o caso já tem. */
export function gherkinTemplate(
  record: Partial<Pick<TestRecord, "title" | "preconditions" | "expectedResult" | "module">>,
) {
  const funcionalidade = record.module?.trim() || "Nome da funcionalidade";
  const cenario = record.title?.trim() || "Comportamento que este teste verifica";
  const dado = record.preconditions?.trim() || "o estado inicial (quem está logado, em que tela)";
  const entao = record.expectedResult?.trim() || "o resultado que o usuário vê";
  return [
    `Funcionalidade: ${funcionalidade}`,
    "",
    `  Cenário: ${cenario}`,
    `    Dado que ${dado}`,
    "    Quando eu faço a ação principal",
    `    Então ${entao}`,
  ].join("\n");
}
