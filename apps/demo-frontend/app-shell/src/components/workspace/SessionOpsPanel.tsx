import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { WorkspaceCase } from "@/data/workspace";
import type { RuntimeCaseWiki } from "@/hooks/useWorkspaceRuntime";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";
import {
  buildRuntimeSessionReplaySummary,
  buildSessionExportMarkdown,
  buildSessionExportPayload,
  fetchRuntimeSessionReplay,
} from "@/lib/runtime-session-replay";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileJson,
  FileText,
  RefreshCcw,
  Radio,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type SessionOpsPanelProps = {
  caseValue: WorkspaceCase;
  wiki: RuntimeCaseWiki | undefined;
};

function formatStatusLabel(value: string | null | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.replace(/[_-]+/g, " ").trim();
}

function triggerDownload(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const SessionOpsPanel = ({ caseValue, wiki }: SessionOpsPanelProps) => {
  const queryClient = useQueryClient();
  const { runtimeDiagnostics } = useWorkspaceRuntime();
  const sessionId = caseValue.sessionId ?? wiki?.sessionId ?? null;

  const replayQuery = useQuery({
    queryKey: ["app-shell", "session-replay", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchRuntimeSessionReplay(sessionId ?? ""),
    staleTime: 30_000,
    retry: 1,
  });

  const replaySummary = buildRuntimeSessionReplaySummary(replayQuery.data);
  const exportReady =
    wiki?.operatorPreviewPack?.compliance?.enforcement?.exportReady ??
    wiki?.compliance?.enforcement?.exportReady;
  const exportBlocked = exportReady === false;
  const exportSummary =
    wiki?.compliance?.enforcement?.summary?.trim() ||
    wiki?.operatorPreviewPack?.remediation?.draft?.summary ||
    (exportBlocked
      ? "Case Wiki export is blocked until raw evidence refs are redacted or signed proof replaces the current blocker."
      : "Session export is ready to include repo-owned Case Wiki and replay evidence.");

  const refreshReplay = async () => {
    try {
      await replayQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["app-shell", "operator-summary"] });
      toast.success(`Session replay refreshed for ${caseValue.ref}`);
    } catch {
      toast.error("Runtime session replay refresh failed.");
    }
  };

  const refreshCaseWiki = async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["app-shell", "case-wikis"] }),
        queryClient.invalidateQueries({ queryKey: ["app-shell", "operator-summary"] }),
      ]);
      toast.success(`Case Wiki refresh queued for ${caseValue.ref}`);
    } catch {
      toast.error("Runtime case wiki refresh failed.");
    }
  };

  const downloadMarkdown = () => {
    if (exportBlocked) {
      toast.error(exportSummary);
      return;
    }
    const payload = buildSessionExportPayload({
      caseValue,
      wiki,
      replaySummary,
      runtimeDiagnostics,
    });
    const markdown = buildSessionExportMarkdown(payload);
    triggerDownload(`${caseValue.ref.toLowerCase()}-session-export.md`, markdown, "text/markdown;charset=utf-8");
    toast.success(`Export Markdown downloaded for ${caseValue.ref}`);
  };

  const downloadJson = () => {
    if (exportBlocked) {
      toast.error(exportSummary);
      return;
    }
    const payload = buildSessionExportPayload({
      caseValue,
      wiki,
      replaySummary,
      runtimeDiagnostics,
    });
    triggerDownload(
      `${caseValue.ref.toLowerCase()}-session-export.json`,
      `${JSON.stringify(payload, null, 2)}\n`,
      "application/json;charset=utf-8",
    );
    toast.success(`Export JSON downloaded for ${caseValue.ref}`);
  };

  return (
    <section className="relative mt-6 -mx-8 px-8 py-6 bg-secondary/[0.03] border-y border-border/50">
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-border/70" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary mb-3">
            Operator Session Ops
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[30px] leading-[1.1] tracking-tight">
              Replay, export, and proof controls
            </h2>
            <Pill tone={exportBlocked ? "rose" : "mint"} size="sm" dot>
              {exportBlocked ? "Export blocked" : "Export ready"}
            </Pill>
            <Pill tone={replaySummary?.resumeReady ? "mint" : "violet"} size="sm">
              {replaySummary?.resumeReady ? "Replay primed" : "Replay inspect"}
            </Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {exportSummary}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="h-9 px-3 text-[12px]" onClick={refreshReplay}>
            <RefreshCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Refresh replay
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-[12px]" onClick={refreshCaseWiki}>
            <RefreshCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Refresh Case Wiki
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-[12px]" onClick={downloadMarkdown}>
            <FileText className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Export Markdown
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-[12px]" onClick={downloadJson}>
            <FileJson className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Export JSON
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Radio className="h-3.5 w-3.5" strokeWidth={1.75} />
              Replay transport
            </div>
            <div className="mt-3 text-[15px] leading-relaxed text-foreground/92">
              {formatStatusLabel(replaySummary?.liveTransportMode, "No live transport evidence")}
            </div>
            <div className="mt-2 space-y-1 text-sm leading-relaxed text-muted-foreground">
              <div>Provider: {replaySummary?.liveTransportProvider ?? "unknown"}</div>
              <div>Bootstrap: {replaySummary?.liveTransportBootstrapState ?? "unknown"}</div>
              <div>
                Evidence: {replaySummary?.liveTransportEvidenceSource ?? "runtime session replay"}
              </div>
            </div>
          </article>

          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {exportBlocked ? (
                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              Export posture
            </div>
            <div className="mt-3 text-[15px] leading-relaxed text-foreground/92">
              {exportBlocked ? "case wiki export blocked" : "session export ready"}
            </div>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {wiki?.operatorPreviewPack?.remediation?.draft?.title ??
                wiki?.compliance?.enforcement?.status ??
                "Repo-owned export posture is in sync with the current Case Wiki."}
            </div>
          </article>

          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4 md:col-span-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Next operator checklist
            </div>
            {replaySummary?.nextOperatorChecklist.length ? (
              <ol className="mt-3 space-y-2">
                {replaySummary.nextOperatorChecklist.map((entry, index) => (
                  <li key={`${index}-${entry}`} className="flex items-start gap-2 text-sm leading-relaxed">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/70 font-mono text-[10px] text-foreground/75">
                      {index + 1}
                    </span>
                    <span className="text-foreground/88">{entry}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Operator Session Ops will show the next replay checklist as soon as the runtime mirror publishes it.
              </div>
            )}
          </article>
        </div>

        <aside className="rounded-[24px] border border-border/60 bg-background/70 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Session export
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Session</dt>
              <dd className="font-mono text-[12px] text-foreground/88">
                {sessionId ?? "not linked"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Replay state</dt>
              <dd className="text-right text-foreground/88">
                {formatStatusLabel(replaySummary?.replayState, "awaiting replay")}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Boundary owner</dt>
              <dd className="text-right text-foreground/88">
                {replaySummary?.boundaryOwnerName ?? replaySummary?.boundaryOwnerRole ?? "not published"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Latest proof</dt>
              <dd className="max-w-[16rem] text-right text-foreground/88">
                {replaySummary?.latestProofSummary ?? "not published"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Proof ingress</dt>
              <dd className="text-right font-mono text-[11px] text-foreground/88">
                {replaySummary?.latestProofContextSource || replaySummary?.latestProofIngressSource
                  ? `${replaySummary?.latestProofContextSource ?? "unknown"} via ${replaySummary?.latestProofIngressSource ?? "unknown"}`
                  : "not published"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-border/50 pt-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Download
            </div>
            <div className="mt-3 grid gap-2">
              <Button variant="secondary" className="justify-start" onClick={downloadMarkdown}>
                <Download className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Export Markdown
              </Button>
              <Button variant="secondary" className="justify-start" onClick={downloadJson}>
                <Download className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Export JSON
              </Button>
            </div>
            <div className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {exportBlocked
                ? exportSummary
                : "Exports include Case Wiki, replay boundary, and runtime ingress provenance for this case."}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};
