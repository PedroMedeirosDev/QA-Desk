import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Plus, Trash2, Upload } from "lucide-react";
import { ExecutionModeBadge } from "@/components/ExecutionModeBadge";
import { AutomationReadinessBadge } from "@/components/AutomationReadinessBadge";
import { api, type AutomationFlow } from "@/lib/api";
import { toastErrorMessage, useToast } from "@/lib/toast";
import { useRunProgress } from "@/lib/run-progress";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { countTestRuns, historyRunFailure, activeFailedRun } from "@/lib/history";
import { projectDetailPath, projectListPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import { getProjectChannels, type ProductChannel } from "@/config/channels";
import type { BugStatus, ProjectSlug, TestRecord } from "@/types/test-record";
import {
  BUG_STATUS_LABELS,
  CHANNEL_LABELS,
  HOMOLOGATION_LABELS,
  RECORD_TYPE_LABELS,
  formatTestId,
  isTestCase,
} from "@/types/test-record";

const emptyDraft = (
  project: ProjectSlug,
  channel?: ProductChannel,
): Partial<TestRecord> => ({
  project,
  channel: channel ?? (project === "polygonus" ? "app" : undefined),
  recordType: "teste",
  homologationStatus: "pendente",
  executionMode: "manual",
  title: "",
  description: "",
  preconditions: "",
  steps: [""],
  expectedResult: "",
  actualResult: "",
  platform: channel === "app" ? "android" : "web",
  module: "",
  status: "rascunho",
  priority: "media",
  build: "",
  showInPortfolio: false,
});

export function TestEditorPage({
  project,
  channel,
  id,
  isNew = !id,
}: {
  project: ProjectSlug;
  channel?: ProductChannel;
  id?: string;
  isNew?: boolean;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { runAutomation, running: liveRunning } = useRunProgress();
  const [tab, setTab] = useState<"detalhes" | "historico">("detalhes");
  const [form, setForm] = useState<Partial<TestRecord>>(emptyDraft(project, channel));
  const [saving, setSaving] = useState(false);
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [running, setRunning] = useState(false);
  const busyRun = running || liveRunning;

  const isHomologation = isTestCase(form);

  useEffect(() => {
    if (project === "polygonus") {
      api.listFlows(project, "mural").then(setFlows).catch(() => setFlows([]));
    }
  }, [project]);

  useEffect(() => {
    if (!isNew && id) {
      api.getTest(project, id).then(setForm).catch(() => toast.error("Teste não encontrado"));
    } else {
      setForm(emptyDraft(project, channel));
    }
  }, [project, id, isNew, channel]);

  function update<K extends keyof TestRecord>(key: K, value: TestRecord[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.createTest(project, form);
        navigate(projectDetailPath(project, created.id, created.channel ?? channel), {
          replace: true,
        });
      } else if (id) {
        const updated = await api.updateTest(project, id, form);
        setForm(updated);
      }
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmHomologation() {
    if (!id || !isHomologation) return;
    setSaving(true);
    try {
      const updated = await api.updateTest(project, id, {
        ...form,
        homologationStatus: "homologado",
      });
      setForm(updated);
    } finally {
      setSaving(false);
    }
  }

  async function runMaestro() {
    if (!id || isNew) return;
    setRunning(true);
    try {
      const res = await runAutomation({
        project,
        testId: id,
        title: form.title || formatTestId(id),
      });
      setForm(res.report);
      const ver = res.appVersion ? ` · v${res.appVersion}` : "";
      if (res.ok) {
        toast.success(`Execução #${res.runNumber} passou${ver}`);
      } else {
        const where =
          res.failure?.failedStepLabel ??
          res.failure?.failedAction ??
          "veja o painel / histórico";
        toast.error(`Execução #${res.runNumber} falhou${ver} — ${where}`, {
          title: "Maestro",
        });
        // Mantém a aba atual — o painel de progresso já mostra o erro
      }
    } catch (e) {
      toast.error(toastErrorMessage(e, "Erro ao executar"));
    } finally {
      setRunning(false);
    }
  }

  function attachFlow(flowPath: string, label: string) {
    update("automation", {
      type: "maestro",
      flowPath,
      label,
      readiness: "draft",
    });
    update("executionMode", "automated");
  }

  async function onUpload(file: File) {
    if (!id || isNew) {
      toast.error("Salve o teste antes de anexar print");
      return;
    }
    await api.uploadEvidence(project, id, file);
    setForm(await api.getTest(project, id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to={projectListPath(project, channel ?? form.channel)}
          className={cn(actionBtnBase, actionBtn.back, "size-9 px-0")}
          title="Voltar à lista"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {isNew ? "Novo teste" : formatTestId(form.id ?? "")}
          </p>
          {!isNew && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ExecutionModeBadge record={form} />
              <AutomationReadinessBadge record={form} />
              <span className="text-xs text-muted-foreground">
                {countTestRuns(form.history ?? [])} rodada(s)
              </span>
              {form.build && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                  App {form.build}
                </span>
              )}
            </div>
          )}
          <h2 className="text-lg font-semibold">{form.title || "Sem título"}</h2>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {(["detalhes", "historico"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm capitalize transition-colors",
              tab === t ? actionBtn.tabActive : actionBtn.tabIdle,
            )}
          >
            {t === "detalhes" ? "Detalhes" : "Histórico"}
          </button>
        ))}
      </div>

      {tab === "detalhes" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4 rounded-xl border bg-card p-6">
            <Field label="Título *">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.title ?? ""}
                onChange={(e) => update("title", e.target.value)}
              />
            </Field>
            <Field label="Descrição">
              <textarea
                className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
            <Field label="Pré-condições">
              <textarea
                className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                value={form.preconditions ?? ""}
                onChange={(e) => update("preconditions", e.target.value)}
              />
            </Field>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Passos do teste</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                  onClick={() => update("steps", [...(form.steps ?? []), ""])}
                >
                  <Plus className="size-3" /> Adicionar passo
                </button>
              </div>
              {(() => {
                const failed = activeFailedRun(form.history ?? []);
                const failInfo = failed ? historyRunFailure(failed) : undefined;
                const failedIdx = failInfo?.stepIndex;
                return (
                  <div className="space-y-2">
                    {(form.steps ?? []).map((step, i) => {
                      const isFailedStep = failedIdx === i;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex gap-2 rounded-md",
                            isFailedStep &&
                              "border border-red-500/40 bg-red-500/10 p-1.5",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-2 w-6 text-xs",
                              isFailedStep
                                ? "font-semibold text-red-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {i + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <input
                              className={cn(
                                "w-full rounded-md border px-3 py-2 text-sm",
                                isFailedStep && "border-red-500/50",
                              )}
                              value={step}
                              onChange={(e) => {
                                const steps = [...(form.steps ?? [])];
                                steps[i] = e.target.value;
                                update("steps", steps);
                              }}
                            />
                            {isFailedStep && failInfo && (
                              <p className="mt-1 text-[0.7rem] text-red-300">
                                Falhou aqui
                                {failInfo.action ? ` · ${failInfo.action}` : ""}
                                {failInfo.flow ? ` · ${failInfo.flow}` : ""}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="mt-1 rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                            title="Remover passo"
                            onClick={() =>
                              update(
                                "steps",
                                (form.steps ?? []).filter((_, j) => j !== i),
                              )
                            }
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <Field label="Resultado esperado">
              <textarea
                className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                value={form.expectedResult ?? ""}
                onChange={(e) => update("expectedResult", e.target.value)}
              />
            </Field>
            {!isHomologation && (
              <Field label="Resultado observado">
                <textarea
                  className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.actualResult ?? ""}
                  onChange={(e) => update("actualResult", e.target.value)}
                />
              </Field>
            )}
            {isHomologation && form.homologationStatus === "falhou" && (
              <Field label="Observações (falha / bug encontrado)">
                <textarea
                  className="min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Descreva o que falhou ou converta para Bug encontrado no painel lateral"
                  value={form.actualResult ?? ""}
                  onChange={(e) => update("actualResult", e.target.value)}
                />
              </Field>
            )}

            <div>
              <span className="text-sm font-medium">Evidência (prints)</span>
              <div className="mt-2 flex flex-wrap gap-3">
                {(form.evidence ?? []).map((ev) => (
                  <a
                    key={ev.fileId}
                    href={api.evidenceUrl(ev.storageKey)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-md border"
                  >
                    <img
                      src={api.evidenceUrl(ev.storageKey)}
                      alt={ev.filename}
                      className="h-24 w-auto object-cover"
                    />
                  </a>
                ))}
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm surface-brand hover:brightness-110">
                <Upload className="size-4" />
                Anexar print
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUpload(f);
                  }}
                />
              </label>
            </div>
          </div>

          <aside className="space-y-4 rounded-xl border bg-card p-4 h-fit">
            {getProjectChannels(project).length > 0 && (
              <PropSelect
                label="Canal"
                value={form.channel ?? "app"}
                options={(Object.keys(CHANNEL_LABELS) as ProductChannel[]).map((k) => ({
                  value: k,
                  label: CHANNEL_LABELS[k],
                }))}
                onChange={(v) => update("channel", v as ProductChannel)}
              />
            )}
            <PropSelect
              label="Natureza"
              value={form.recordType ?? "teste"}
              options={Object.entries(RECORD_TYPE_LABELS).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
              onChange={(v) => {
                update("recordType", v as TestRecord["recordType"]);
                if (v === "teste") update("homologationStatus", "pendente");
              }}
            />

            {isHomologation ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Homologação</p>
                <p className="text-sm font-medium">
                  {HOMOLOGATION_LABELS[form.homologationStatus ?? "pendente"]}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Atualizado automaticamente ao executar Maestro
                </p>
              </div>
            ) : (
              <PropSelect
                label="Status do bug"
                value={form.status ?? "rascunho"}
                options={Object.entries(BUG_STATUS_LABELS).map(([k, v]) => ({
                  value: k,
                  label: v,
                }))}
                onChange={(v) => update("status", v as BugStatus)}
              />
            )}

            <PropSelect
              label="Plataforma"
              value={form.platform ?? "web"}
              options={[
                { value: "web", label: "Web" },
                { value: "android", label: "Android" },
                { value: "ios", label: "iOS" },
                { value: "api", label: "API" },
                { value: "outro", label: "Outro" },
              ]}
              onChange={(v) => update("platform", v as TestRecord["platform"])}
            />
            <Field label="Módulo">
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.module ?? ""}
                onChange={(e) => update("module", e.target.value)}
              />
            </Field>
            <Field label="Versão do app (login)">
              <input
                className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                value={form.build ?? ""}
                onChange={(e) => update("build", e.target.value)}
                placeholder="Preenchida ao rodar o Maestro"
                title="Mesma versão exibida na tela de login; atualizada a cada execução"
              />
            </Field>

            <div className="space-y-2 border-t pt-3">
              <span className="text-sm font-medium">Maestro</span>
              {form.automation?.flowPath ? (
                <>
                  <p className="rounded-md border bg-muted/30 p-2 font-mono text-xs break-all">
                    {form.automation.label ?? form.automation.flowPath}
                  </p>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Status do flow
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                      value={form.automation.readiness === "ready" ? "ready" : "draft"}
                      onChange={(e) =>
                        update("automation", {
                          ...form.automation!,
                          readiness: e.target.value as "draft" | "ready",
                        })
                      }
                    >
                      <option value="draft">Em construção (Studio)</option>
                      <option value="ready">Pronto (validado 2×)</option>
                    </select>
                  </label>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum flow vinculado</p>
              )}
              {flows.length > 0 && (
                <select
                  className="w-full rounded-md border px-2 py-1.5 text-xs"
                  value={form.automation?.flowPath ?? ""}
                  onChange={(e) => {
                    const f = flows.find((x) => x.flowPath === e.target.value);
                    if (f) attachFlow(f.flowPath, f.label);
                  }}
                >
                  <option value="">Vincular flow…</option>
                  {flows.map((f) => (
                    <option key={f.flowPath} value={f.flowPath}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
              {!isNew && form.automation?.flowPath && (
                <button
                  type="button"
                  onClick={() => void runMaestro()}
                  disabled={busyRun || saving}
                  className={cn(actionBtnBase, actionBtn.run, "w-full")}
                >
                  <Play className="size-4" />
                  {busyRun ? "Executando…" : "Executar teste"}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className={cn(actionBtnBase, actionBtn.save, "w-full")}
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
              {isHomologation && form.homologationStatus === "passou" && !isNew && (
                <button
                  type="button"
                  onClick={() => void confirmHomologation()}
                  disabled={saving}
                  className={cn(actionBtnBase, actionBtn.homologate, "w-full")}
                >
                  Confirmar homologação manual
                </button>
              )}
              {!isHomologation && form.status === "corrigido_gestor" && !isNew && (
                <button
                  type="button"
                  onClick={() =>
                    void api
                      .updateTest(project, id!, { ...form, status: "homologado" })
                      .then(setForm)
                  }
                  disabled={saving}
                  className={cn(actionBtnBase, actionBtn.homologate, "w-full")}
                >
                  Confirmar homologação (bug)
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-6">
          <HistoryTimeline entries={form.history ?? []} />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function PropSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
