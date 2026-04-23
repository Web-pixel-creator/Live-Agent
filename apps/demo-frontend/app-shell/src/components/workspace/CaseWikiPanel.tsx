import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { RuntimeCaseWiki, RuntimeCaseWikiQuestion } from "@/hooks/useWorkspaceRuntime";
import {
  buildCaseBundlePath,
  buildCaseEvidencePath,
  buildCaseVaultPath,
} from "@/lib/case-artifact-links";
import {
  buildRuntimeArtifactViewerPath,
  RUNTIME_ARTIFACT_VIEW_PRESETS,
} from "@/lib/runtime-artifact-viewer";
import type { WorkspaceCase } from "@/data/workspace";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type CaseWikiPanelProps = {
  caseValue: WorkspaceCase;
  wiki: RuntimeCaseWiki | undefined;
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "now";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "now";
  }
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function collectCaseWikiRefs(wiki: RuntimeCaseWiki | undefined): string[] {
  if (!wiki) {
    return [];
  }
  const refs = new Set<string>();
  const pushRefs = (items: string[] | null | undefined) => {
    if (!Array.isArray(items)) {
      return;
    }
    for (const item of items) {
      if (typeof item === "string" && item.trim().length > 0) {
        refs.add(item.trim());
      }
    }
  };

  pushRefs(wiki.recommendedNextAction?.sourceRefs);
  pushRefs(wiki.highlights.topBlockingQuestion?.sourceRefs);
  wiki.openQuestions.forEach((item) => pushRefs(item.sourceRefs));
  wiki.timeline.forEach((item) => pushRefs(item.sourceRefs));
  wiki.entities.forEach((item) => pushRefs(item.sourceRefs));
  return [...refs].slice(0, 8);
}

function pickBlockingQuestion(wiki: RuntimeCaseWiki | undefined): RuntimeCaseWikiQuestion | null {
  if (!wiki) {
    return null;
  }
  return (
    wiki.highlights.topBlockingQuestion ??
    wiki.openQuestions.find((item) => item.blocking) ??
    wiki.openQuestions[0] ??
    null
  );
}

function formatStatusLabel(value: string | null | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.replace(/[_-]+/g, " ").trim();
}

function formatRemediationRef(value: string | null | undefined): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  if (value.startsWith("file:")) {
    const normalized = value.slice("file:".length);
    const segments = normalized.split(/[\\/]+/u).filter(Boolean);
    return segments.at(-1) ?? value;
  }
  return value;
}

export const CaseWikiPanel = ({ caseValue, wiki }: CaseWikiPanelProps) => {
  const bundlePath = buildCaseBundlePath(caseValue);
  const evidencePath = buildCaseEvidencePath(caseValue);
  const runtimeProofPath = buildRuntimeArtifactViewerPath(
    RUNTIME_ARTIFACT_VIEW_PRESETS.runtimeProof,
    { caseRef: caseValue.ref },
  );
  const caseVaultPath = buildCaseVaultPath(caseValue);
  const refs = collectCaseWikiRefs(wiki);
  const blockingQuestion = pickBlockingQuestion(wiki);
  const nextAction = wiki?.recommendedNextAction ?? null;
  const remediationDraft = wiki?.operatorPreviewPack?.remediation?.draft ?? null;
  const complianceEnforcement = wiki?.compliance?.enforcement ?? null;
  const remediationPrimaryAction = complianceEnforcement?.remediation?.primaryAction ?? null;
  const exportReady =
    wiki?.operatorPreviewPack?.compliance?.enforcement?.exportReady ??
    wiki?.compliance?.enforcement?.exportReady;
  const complianceSummary =
    wiki?.compliance?.enforcement?.summary?.trim() ||
    remediationDraft?.summary ||
    (exportReady === false
      ? "Export and handoff remain blocked by repo-owned compliance enforcement."
      : "Repo-owned export posture is ready for downstream handoff.");
  const signatureStatus = wiki?.evidenceSignature?.status ?? null;
  const signatureReady = signatureStatus === "signed";
  const exportBlocked = exportReady === false;
  const hasRawArtifactBlocker =
    remediationPrimaryAction?.kind === "redact_artifact" ||
    remediationPrimaryAction?.kind === "replace_with_redacted_artifact" ||
    complianceEnforcement?.blockingReasons?.some((reason) => reason === "raw_like_source_refs_detected") === true;
  const hasSignatureBlocker =
    remediationPrimaryAction?.kind === "attach_case_wiki_signature" ||
    remediationPrimaryAction?.kind === "replace_with_signed_artifact" ||
    complianceEnforcement?.blockingReasons?.some((reason) => reason === "case_wiki_signature_missing") === true;
  const remediationHint = [remediationPrimaryAction?.operatorActionLabel?.trim(), formatRemediationRef(remediationPrimaryAction?.blockingRef ?? null)]
    .filter((item): item is string => Boolean(item && item.trim().length > 0))
    .join(" · ");
  const railColor = exportBlocked
    ? "bg-[hsl(var(--tint-rose-fg))]"
    : signatureReady
      ? "bg-[hsl(var(--tint-mint-fg))]"
      : "bg-[hsl(var(--tint-violet-fg))]";

  const handoffLines = wiki
    ? [
        `${caseValue.ref} - ${caseValue.client}`,
        wiki.overview.summary,
        blockingQuestion ? `Blocker: ${blockingQuestion.question}` : null,
        nextAction ? `Next action: ${nextAction.title} - ${nextAction.summary}` : null,
        `Bundle: ${typeof window !== "undefined" ? window.location.origin : ""}${bundlePath}`,
        `Evidence: ${typeof window !== "undefined" ? window.location.origin : ""}${evidencePath}`,
      ].filter((item): item is string => Boolean(item && item.trim().length > 0))
    : [];

  const remediationLines = remediationDraft
    ? [
        remediationDraft.title,
        remediationDraft.summary,
        remediationDraft.body,
        ...remediationDraft.checklist.map((item) => `- ${item}`),
      ]
    : [];

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Clipboard is unavailable in this browser.");
    }
  };

  const handleBlockedExport = () => {
    toast.error(complianceSummary);
  };

  const handleCopyHandoff = () => {
    if (exportReady === false) {
      handleBlockedExport();
      return;
    }
    if (handoffLines.length === 0) {
      toast.error("Case Wiki handoff is not hydrated yet.");
      return;
    }
    void copyText(handoffLines.join("\n"), `Copied handoff for ${caseValue.ref}`);
  };

  const handleCopyRefs = () => {
    if (exportReady === false) {
      handleBlockedExport();
      return;
    }
    if (refs.length === 0) {
      toast.error("No repo-owned source refs are available yet.");
      return;
    }
    void copyText(refs.join("\n"), `Copied ${refs.length} source refs`);
  };

  const handleCopyRemediation = () => {
    if (remediationLines.length === 0) {
      toast.error("No remediation draft is available yet.");
      return;
    }
    void copyText(remediationLines.join("\n\n"), `Copied remediation draft for ${caseValue.ref}`);
  };

  return (
    <section
      id="case-wiki"
      className="relative mt-10 -mx-8 scroll-mt-24 px-8 py-6 bg-secondary/[0.04] border-y border-border/50"
    >
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-[3px] ${railColor}`} />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary mb-3">
            Case Wiki
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[30px] leading-[1.1] tracking-tight">
              Repo-owned case memory
            </h2>
            <Pill tone={exportBlocked ? "rose" : "mint"} size="sm" dot>
              {exportBlocked ? "Export blocked" : "Export ready"}
            </Pill>
            <Pill tone={signatureReady ? "mint" : "violet"} size="sm">
              {signatureReady ? "Signed evidence" : "Unsigned evidence"}
            </Pill>
            {wiki?.overview.currentStage ? (
              <Pill tone="slate" size="sm">
                {wiki.overview.currentStage}
              </Pill>
            ) : null}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {wiki?.overview.summary ??
              "This runtime case is expected to hydrate a compiled Case Wiki, but the current summary snapshot has not arrived yet."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button asChild variant="ghost" className="h-9 px-3 text-[12px]">
            <Link to={bundlePath}>
              <FileText className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Open bundle
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-9 px-3 text-[12px]">
            <Link to={evidencePath}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Open evidence
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-9 px-3 text-[12px]">
            <Link to={runtimeProofPath}>
              <ShieldCheck className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Inspect proof
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-9 px-3 text-[12px]">
            <Link to={caseVaultPath}>
              <Sparkles className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Open Case Vault
            </Link>
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-[12px]" onClick={handleCopyHandoff}>
            <Copy className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Copy handoff
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-[12px]" onClick={handleCopyRefs}>
            <Copy className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Copy refs
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
              Top blocker
            </div>
            <div className="mt-3 text-[15px] leading-relaxed text-foreground/92">
              {blockingQuestion?.question ?? "No blocking question is currently compiled into the Case Wiki."}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone={blockingQuestion?.blocking ? "rose" : "slate"} size="sm">
                {blockingQuestion?.blocking ? "Blocking" : "No blocker"}
              </Pill>
              {blockingQuestion?.owner ? (
                <Pill tone="slate" size="sm">
                  Owner - {blockingQuestion.owner}
                </Pill>
              ) : null}
            </div>
          </article>

          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              Next action
            </div>
            <div className="mt-3 text-[15px] leading-relaxed text-foreground/92">
              {nextAction?.title ?? "No repo-owned next action is currently published."}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {nextAction?.summary ??
                "Refresh runtime memory to hydrate a compiled next action for this case."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {nextAction?.owner ? (
                <Pill tone={nextAction.blocking ? "rose" : "violet"} size="sm">
                  {nextAction.owner}
                </Pill>
              ) : null}
              {nextAction?.dueBy ? (
                <Pill tone="slate" size="sm">
                  Due - {formatTimestamp(nextAction.dueBy)}
                </Pill>
              ) : null}
            </div>
          </article>

          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4 md:col-span-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {exportBlocked ? (
                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              Compliance & remediation
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone={exportBlocked ? "rose" : "mint"} size="sm" dot>
                {exportBlocked ? "Export blocked" : "Export ready"}
              </Pill>
              {hasRawArtifactBlocker ? (
                <Pill tone="rose" size="sm">
                  Raw artifact blocker
                </Pill>
              ) : null}
              <Pill tone={signatureReady ? "mint" : "violet"} size="sm">
                Signature - {formatStatusLabel(signatureStatus, "pending")}
              </Pill>
              {hasSignatureBlocker ? (
                <Pill tone="violet" size="sm">
                  Signature pending
                </Pill>
              ) : null}
              <Pill tone="slate" size="sm">
                {formatStatusLabel(wiki?.compliance?.enforcement?.status, "status pending")}
              </Pill>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{complianceSummary}</p>
            {remediationHint ? (
              <div className="mt-3 rounded-2xl border border-border/50 bg-background/55 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                Next repo-owned step: <span className="text-foreground/88">{remediationHint}</span>
              </div>
            ) : null}
            {remediationDraft ? (
              <div className="mt-4 rounded-2xl border border-border/50 bg-secondary/[0.22] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Primary remediation
                    </div>
                    <div className="mt-2 text-[15px] leading-relaxed text-foreground/92">
                      {remediationDraft.title}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {remediationDraft.body}
                    </p>
                  </div>
                  <Button variant="ghost" className="h-8 px-3 text-[12px]" onClick={handleCopyRemediation}>
                    <Copy className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                    Copy remediation
                  </Button>
                </div>
                {remediationDraft.checklist.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {remediationDraft.checklist.slice(0, 3).map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground/85">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.25} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </article>
        </div>

        <aside className="rounded-[24px] border border-border/60 bg-background/70 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Operator preview
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Generated</dt>
              <dd className="font-mono text-[12px] text-foreground/88">
                {formatTimestamp(wiki?.generatedAt)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Current stage</dt>
              <dd className="text-right text-foreground/88">
                {wiki?.overview.currentStage ?? caseValue.stage}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Customer goal</dt>
              <dd className="max-w-[16rem] text-right text-foreground/88">
                {wiki?.overview.customerGoal ?? "Not published"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Open questions</dt>
              <dd className="font-mono text-[12px] text-foreground/88">
                {wiki?.openQuestions.length ?? 0}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Source refs</dt>
              <dd className="font-mono text-[12px] text-foreground/88">
                {refs.length}
              </dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-border/50 pt-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Timer className="h-3.5 w-3.5" strokeWidth={1.75} />
              Recent memory trail
            </div>
            {wiki?.timeline.length ? (
              <ol className="mt-3 space-y-2.5">
                {wiki.timeline.slice(0, 3).map((entry) => (
                  <li key={`${entry.ts}-${entry.title}`} className="text-xs leading-relaxed">
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {formatTimestamp(entry.ts)}
                    </div>
                    <div className="mt-1 text-foreground/88">{entry.title}</div>
                    <div className="text-muted-foreground">{entry.summary}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Case Wiki timeline entries will appear here after the runtime snapshot hydrates.
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
