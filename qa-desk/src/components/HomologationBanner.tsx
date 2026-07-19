import { ClipboardList, Target } from "lucide-react";
import { actionBtn, actionBtnBase } from "@/lib/button-styles";
import { projectHomologationPath } from "@/lib/project-paths";
import { cn } from "@/lib/utils";
import type { ProductChannel } from "@/config/channels";
import { MURAL_HOMOLOGATION_SLUG } from "@/config/homologations";
import type { ProjectSlug } from "@/types/test-record";
import {
  HOMOLOGATION_CYCLE_LABELS,
  type HomologationWithProgress,
} from "@/types/homologation";

interface HomologationBannerProps {
  project: ProjectSlug;
  channel?: ProductChannel;
  homologation: HomologationWithProgress;
  testCount?: number;
  onOpen: (slug: string) => void;
  onMuralChecklist?: () => void;
  muted?: boolean;
}

export function HomologationBanner({
  homologation,
  testCount = 0,
  onOpen,
  onMuralChecklist,
  muted = false,
}: HomologationBannerProps) {
  const { progress } = homologation;
  const pct =
    progress.total > 0 ? Math.round((progress.passed / progress.total) * 100) : 0;
  const isMural = homologation.slug === MURAL_HOMOLOGATION_SLUG;
  const isDone = homologation.status === "concluida";

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        muted ? "border-border bg-card/60 opacity-90" : "surface-brand",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{homologation.title}</p>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs",
                isDone
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : homologation.status === "pausada"
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border-white/25 bg-white/10",
              )}
            >
              {HOMOLOGATION_CYCLE_LABELS[homologation.status]}
            </span>
          </div>
          {homologation.description && (
            <p className="mt-1 text-sm opacity-90">{homologation.description}</p>
          )}
          {progress.total > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium">
                {progress.passed}/{progress.total} passou
                {progress.failed > 0 && (
                  <span className="ml-2 text-red-300">· {progress.failed} falhou</span>
                )}
              </p>
              <div className="h-1.5 max-w-xs overflow-hidden rounded-full bg-black/20">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
          <p className="mt-2 font-mono text-xs opacity-80">
            {homologation.id} · <code>{homologation.slug}</code>
            {testCount > 0 && <> · {testCount} teste(s) vinculado(s)</>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpen(homologation.slug)}
            className={cn(actionBtnBase, muted ? actionBtn.back : actionBtn.onBrand, "px-3")}
          >
            <Target className="size-4" />
            Abrir homologação
          </button>
          {isMural && onMuralChecklist && !isDone && (
            <button
              type="button"
              onClick={onMuralChecklist}
              className={cn(actionBtnBase, actionBtn.checklist, "px-3")}
            >
              <ClipboardList className="size-4" />
              {testCount > 0 ? "Sincronizar checklist" : "Criar checklist Mural"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Atalho para navegação — usado pelo pai */
export function homologationPath(project: ProjectSlug, slug: string) {
  return projectHomologationPath(project, slug);
}
