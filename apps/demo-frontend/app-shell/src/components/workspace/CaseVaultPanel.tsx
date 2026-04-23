import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { RuntimeCaseWiki } from "@/hooks/useWorkspaceRuntime";
import {
  buildRuntimeArtifactViewerPath,
  RUNTIME_ARTIFACT_VIEW_PRESETS,
} from "@/lib/runtime-artifact-viewer";
import type { WorkspaceCase } from "@/data/workspace";
import { buildCaseBundlePath, buildCaseEvidencePath } from "@/lib/case-artifact-links";
import {
  ArrowRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Timer,
  Workflow,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type CaseVaultPanelProps = {
  caseValue: WorkspaceCase;
  wiki: RuntimeCaseWiki | undefined;
};

type RefFamilySummary = {
  family: string;
  count: number;
  sample: string;
};

type CaseVaultProjectionMode = "handoff" | "crm";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "not published";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "not published";
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

function collectCaseVaultRefs(wiki: RuntimeCaseWiki | undefined): string[] {
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
  return [...refs];
}

function classifyRefFamily(ref: string): string {
  const normalized = ref.toLowerCase();
  if (normalized.startsWith("artifact:")) {
    return "artifact";
  }
  if (normalized.startsWith("case_wiki:") || normalized.includes("case wiki")) {
    return "case wiki";
  }
  if (normalized.startsWith("replay:") || normalized.includes("replay")) {
    return "replay";
  }
  if (normalized.startsWith("runtime:") || normalized.includes("runtime")) {
    return "runtime";
  }
  if (normalized.startsWith("session:")) {
    return "session";
  }
  return "other";
}

function summarizeRefFamilies(refs: string[]): RefFamilySummary[] {
  const groups = new Map<string, string[]>();
  for (const ref of refs) {
    const family = classifyRefFamily(ref);
    const current = groups.get(family) ?? [];
    current.push(ref);
    groups.set(family, current);
  }
  return [...groups.entries()]
    .map(([family, items]) => ({
      family,
      count: items.length,
      sample: items[0] ?? family,
    }))
    .sort((left, right) => right.count - left.count || left.family.localeCompare(right.family));
}

function formatFamilyLabel(value: string): string {
  return value.replace(/[_-]+/g, " ");
}

function formatKindLabel(value: string | null | undefined, fallback: string): string {
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

function buildVaultCopyPayload(caseValue: WorkspaceCase, wiki: RuntimeCaseWiki | undefined): string {
  if (!wiki) {
    return `${caseValue.ref}\nCase Vault is waiting for the first compiled Case Wiki snapshot.`;
  }
  const refs = collectCaseVaultRefs(wiki);
  const openQuestions = wiki.openQuestions.slice(0, 4).map((item) => `- ${item.question}`);
  const entities = wiki.entities
    .slice(0, 6)
    .map((item) => `- ${item.label} (${formatKindLabel(item.kind, "entity")})`);
  const recentTrail = wiki.timeline
    .slice(0, 4)
    .map((item) => `- ${formatTimestamp(item.ts)} :: ${item.title}`);

  return [
    `${caseValue.ref} - ${caseValue.client}`,
    wiki.overview.summary,
    wiki.overview.customerGoal ? `Goal: ${wiki.overview.customerGoal}` : null,
    wiki.recommendedNextAction
      ? `Next action: ${wiki.recommendedNextAction.title} - ${wiki.recommendedNextAction.summary}`
      : null,
    openQuestions.length > 0 ? "Open threads:" : null,
    ...openQuestions,
    entities.length > 0 ? "Linked entities:" : null,
    ...entities,
    recentTrail.length > 0 ? "Recent memory trail:" : null,
    ...recentTrail,
    refs.length > 0 ? "Source refs:" : null,
    ...refs.slice(0, 8).map((item) => `- ${item}`),
  ]
    .filter((item): item is string => Boolean(item && item.trim().length > 0))
    .join("\n");
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

function buildVaultHandoffLines(caseValue: WorkspaceCase, wiki: RuntimeCaseWiki | undefined): string[] {
  if (!wiki) {
    return [];
  }
  const bundlePath = buildCaseBundlePath(caseValue);
  const evidencePath = buildCaseEvidencePath(caseValue);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const refs = collectCaseVaultRefs(wiki);
  const priorityQuestions = wiki.openQuestions
    .filter((item) => item.blocking || item.priority === "high")
    .slice(0, 3)
    .map((item) => `- ${item.question}`);
  const recentTrail = wiki.timeline
    .slice(0, 3)
    .map((item) => `- ${formatTimestamp(item.ts)} :: ${item.title}`);

  return [
    `${caseValue.ref} - ${caseValue.client}`,
    wiki.overview.summary,
    wiki.overview.customerGoal ? `Goal: ${wiki.overview.customerGoal}` : null,
    wiki.overview.currentStage ? `Stage: ${wiki.overview.currentStage}` : null,
    wiki.recommendedNextAction
      ? `Next action: ${wiki.recommendedNextAction.title} - ${wiki.recommendedNextAction.summary}`
      : null,
    priorityQuestions.length > 0 ? "Blocking threads:" : null,
    ...priorityQuestions,
    recentTrail.length > 0 ? "Recent trail:" : null,
    ...recentTrail,
    refs.length > 0 ? `Source refs: ${refs.slice(0, 4).join(", ")}` : null,
    `Bundle: ${origin}${bundlePath}`,
    `Evidence: ${origin}${evidencePath}`,
  ].filter((item): item is string => Boolean(item && item.trim().length > 0));
}

function buildVaultCrmPrepLines(caseValue: WorkspaceCase, wiki: RuntimeCaseWiki | undefined): string[] {
  const bundlePath = buildCaseBundlePath(caseValue);
  const evidencePath = buildCaseEvidencePath(caseValue);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const blockingQuestion = wiki?.highlights.topBlockingQuestion ?? wiki?.openQuestions[0] ?? null;
  const nextAction = wiki?.recommendedNextAction ?? null;
  const missingDocuments = caseValue.documents
    .filter((item) => item.state !== "ok")
    .slice(0, 4)
    .map((item) => item.name);

  if (!wiki) {
    return [
      `${caseValue.ref} - ${caseValue.client}`,
      `Visa: ${caseValue.visa}`,
      `Country: ${caseValue.country}`,
      `Owner: ${caseValue.owner}`,
      `Status: waiting for compiled Case Wiki`,
      `Bundle: ${origin}${bundlePath}`,
      `Evidence: ${origin}${evidencePath}`,
    ];
  }

  return [
    `${caseValue.ref} - ${caseValue.client}`,
    `Visa: ${caseValue.visa}`,
    `Country: ${caseValue.country}`,
    `Owner: ${caseValue.owner}`,
    `Stage: ${wiki.overview.currentStage ?? caseValue.stage}`,
    `Status: ${wiki.overview.status}`,
    wiki.overview.customerGoal ? `Goal: ${wiki.overview.customerGoal}` : null,
    blockingQuestion ? `Current blocker: ${blockingQuestion.question}` : null,
    nextAction ? `Next action: ${nextAction.title}` : null,
    missingDocuments.length > 0 ? `Missing or review docs: ${missingDocuments.join(", ")}` : null,
    `Bundle: ${origin}${bundlePath}`,
    `Evidence: ${origin}${evidencePath}`,
  ].filter((item): item is string => Boolean(item && item.trim().length > 0));
}

function buildVaultProjectionLines(
  mode: CaseVaultProjectionMode,
  caseValue: WorkspaceCase,
  wiki: RuntimeCaseWiki | undefined,
): string[] {
  if (mode === "crm") {
    return buildVaultCrmPrepLines(caseValue, wiki);
  }
  return buildVaultHandoffLines(caseValue, wiki);
}

function buildVaultMarkdown(
  caseValue: WorkspaceCase,
  wiki: RuntimeCaseWiki | undefined,
  projectionMode: CaseVaultProjectionMode,
): string {
  const projectionLines = buildVaultProjectionLines(projectionMode, caseValue, wiki);
  if (!wiki) {
    return `# Case Vault Export\n\n- Ref: ${caseValue.ref}\n- Status: waiting for compiled Case Wiki\n`;
  }
  const refs = collectCaseVaultRefs(wiki);
  const entities = wiki.entities
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.label} (${formatKindLabel(item.kind, "entity")}${item.role ? `, ${item.role}` : ""})`,
    );
  const openQuestions = wiki.openQuestions
    .slice(0, 6)
    .map((item) => `- ${item.question}`);
  const timeline = wiki.timeline
    .slice(0, 6)
    .map((item) => `- ${formatTimestamp(item.ts)} :: ${item.title} - ${item.summary}`);

  return [
    "# Case Vault Export",
    "",
    "## Memory anchors",
    `- Ref: ${caseValue.ref}`,
    `- Client: ${caseValue.client}`,
    `- Stage: ${wiki.overview.currentStage ?? caseValue.stage}`,
    `- Status: ${wiki.overview.status}`,
    `- Generated: ${formatTimestamp(wiki.generatedAt)}`,
    `- Customer goal: ${wiki.overview.customerGoal ?? "not published"}`,
    "",
    `## ${projectionMode === "crm" ? "CRM prep projection" : "Operator handoff projection"}`,
    ...projectionLines.map((item) => `- ${item}`),
    "",
    "## Linked entities",
    ...(entities.length > 0 ? entities : ["- none published"]),
    "",
    "## Open threads",
    ...(openQuestions.length > 0 ? openQuestions : ["- none published"]),
    "",
    "## Recent memory trail",
    ...(timeline.length > 0 ? timeline : ["- no timeline entries published"]),
    "",
    "## Source refs",
    ...(refs.length > 0 ? refs.map((item) => `- ${item}`) : ["- none published"]),
    "",
  ].join("\n");
}

export const CaseVaultPanel = ({ caseValue, wiki }: CaseVaultPanelProps) => {
  const [projectionMode, setProjectionMode] = useState<CaseVaultProjectionMode>("handoff");
  const runtimeProofPath = buildRuntimeArtifactViewerPath(
    RUNTIME_ARTIFACT_VIEW_PRESETS.runtimeProof,
    { caseRef: caseValue.ref },
  );
  const bundlePath = buildCaseBundlePath(caseValue);
  const evidencePath = buildCaseEvidencePath(caseValue);
  const refs = collectCaseVaultRefs(wiki);
  const refFamilies = summarizeRefFamilies(refs);
  const entities = wiki?.entities.slice(0, 6) ?? [];
  const openQuestions = wiki?.openQuestions.slice(0, 4) ?? [];
  const timeline = wiki?.timeline.slice(0, 4) ?? [];
  const generatedAt = wiki?.generatedAt ?? null;
  const nextAction = wiki?.recommendedNextAction ?? null;
  const blockingQuestion = wiki?.highlights.topBlockingQuestion ?? wiki?.openQuestions[0] ?? null;
  const copyPayload = buildVaultCopyPayload(caseValue, wiki);
  const projectionLines = useMemo(
    () => buildVaultProjectionLines(projectionMode, caseValue, wiki),
    [projectionMode, caseValue, wiki],
  );
  const vaultMarkdown = useMemo(
    () => buildVaultMarkdown(caseValue, wiki, projectionMode),
    [caseValue, projectionMode, wiki],
  );
  const exportReady =
    wiki?.operatorPreviewPack?.compliance?.enforcement?.exportReady ??
    wiki?.compliance?.enforcement?.exportReady;
  const complianceEnforcement = wiki?.compliance?.enforcement ?? null;
  const remediationPrimaryAction = complianceEnforcement?.remediation?.primaryAction ?? null;
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
  const complianceSummary =
    wiki?.compliance?.enforcement?.summary?.trim() ||
    wiki?.operatorPreviewPack?.remediation?.draft?.summary ||
    (exportBlocked
      ? "Case Vault export is blocked until repo-owned compliance enforcement clears the current raw/signing blockers."
      : "Case Vault handoff is ready to reuse the compiled Case Wiki memory.");
  const projectionTitle =
    projectionMode === "crm" ? "CRM prep projection" : "Operator handoff projection";
  const projectionReadyLabel =
    projectionMode === "crm" ? "Case Vault CRM prep ready" : "Case Vault handoff ready";
  const exportBlockedLabel =
    projectionMode === "crm" ? "Case Vault CRM prep blocked" : "Case Vault export blocked";
  const projectionActionLabel = projectionMode === "crm" ? "Copy CRM prep" : "Copy handoff";
  const projectionExportLabel =
    projectionMode === "crm" ? "Export CRM Markdown" : "Export Markdown";
  const projectionSummary =
    projectionMode === "crm"
      ? "CRM-safe summary for operator handoff, CRM update prep, and downstream status sync."
      : "Operator-facing handoff summary built from the compiled Case Wiki memory graph.";

  const handleCopyVault = async () => {
    try {
      await navigator.clipboard.writeText(copyPayload);
      toast.success(`Copied Case Vault snapshot for ${caseValue.ref}`);
    } catch {
      toast.error("Clipboard is unavailable in this browser.");
    }
  };

  const handleCopyHandoff = async () => {
    if (exportBlocked) {
      toast.error(complianceSummary);
      return;
    }
    if (projectionLines.length === 0) {
      toast.error(`Case Vault ${projectionMode === "crm" ? "CRM prep" : "handoff"} is not hydrated yet.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(projectionLines.join("\n"));
      toast.success(
        `Copied Case Vault ${projectionMode === "crm" ? "CRM prep" : "handoff"} for ${caseValue.ref}`,
      );
    } catch {
      toast.error("Clipboard is unavailable in this browser.");
    }
  };

  const handleExportMarkdown = () => {
    if (exportBlocked) {
      toast.error(complianceSummary);
      return;
    }
    triggerDownload(
      `${caseValue.ref.toLowerCase()}-case-vault-${projectionMode}.md`,
      `${vaultMarkdown}\n`,
      "text/markdown;charset=utf-8",
    );
    toast.success(
      `${projectionMode === "crm" ? "CRM" : "Handoff"} Markdown downloaded for ${caseValue.ref}`,
    );
  };

  return (
    <section
      id="case-vault"
      className="relative mt-6 -mx-8 px-8 py-6 bg-secondary/[0.03] border-y border-border/50 scroll-mt-24"
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px] bg-[hsl(var(--tint-violet-fg))]"
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary mb-3">
            Case Vault
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[30px] leading-[1.1] tracking-tight">
              Inspectable memory projection
            </h2>
            <Pill tone="violet" size="sm">
              Rowboat-style
            </Pill>
            <Pill tone="slate" size="sm">
              {`${entities.length} entities`}
            </Pill>
            <Pill tone="slate" size="sm">
              {`${refs.length} refs`}
            </Pill>
            <Pill tone={exportBlocked ? "rose" : "mint"} size="sm" dot>
              {exportBlocked ? "Export blocked" : "Export ready"}
            </Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Secondary support view of the compiled Case Wiki as linked case memory. Use it to
            inspect entity threads, ref families, open questions, and recent memory trail without
            forcing raw replay or release artifacts into the primary operator screen.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" className="h-9 px-3 text-[12px]">
            <Link to={runtimeProofPath}>
              <FileText className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Inspect proof
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-9 px-3 text-[12px]">
            <Link to={bundlePath}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Open bundle
            </Link>
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-[12px]" onClick={handleCopyHandoff}>
            <Copy className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            {projectionActionLabel}
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-[12px]" onClick={handleExportMarkdown}>
            <Download className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            {projectionExportLabel}
          </Button>
          <Button variant="ghost" className="h-9 px-3 text-[12px]" onClick={handleCopyVault}>
            <Copy className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
            Copy memory
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="grid gap-4">
          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Workflow className="h-3.5 w-3.5" strokeWidth={1.75} />
              Memory anchors
            </div>
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Case</dt>
                <dd className="text-right text-foreground/88">{caseValue.ref}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Session</dt>
                <dd className="text-right font-mono text-[11px] text-foreground/88">
                  {wiki?.sessionId ?? "not linked"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Stage</dt>
                <dd className="text-right text-foreground/88">
                  {wiki?.overview.currentStage ?? caseValue.stage}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Generated</dt>
                <dd className="text-right font-mono text-[11px] text-foreground/88">
                  {formatTimestamp(generatedAt)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Customer goal</dt>
                <dd className="max-w-[18rem] text-right text-foreground/88">
                  {wiki?.overview.customerGoal ?? "Not published"}
                </dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-secondary/[0.18] p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Top blocker
                </div>
                <div className="mt-2 text-sm leading-relaxed text-foreground/88">
                  {blockingQuestion?.question ?? "No blocking question is currently published."}
                </div>
              </div>
              <div className="rounded-2xl border border-border/50 bg-secondary/[0.18] p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Next action
                </div>
                <div className="mt-2 text-sm leading-relaxed text-foreground/88">
                  {nextAction?.title ?? "No repo-owned next action is currently published."}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              Open threads
            </div>
            <div className="mt-4 space-y-3">
              {openQuestions.length > 0 ? (
                openQuestions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border/50 bg-secondary/[0.18] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={item.blocking ? "rose" : "slate"} size="sm">
                        {item.blocking ? "blocking" : "question"}
                      </Pill>
                      <Pill tone={item.priority === "high" ? "amber" : "slate"} size="sm">
                        {item.priority}
                      </Pill>
                      {item.owner ? (
                        <Pill tone="slate" size="sm">
                          {item.owner}
                        </Pill>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-foreground/88">
                      {item.question}
                    </div>
                    {item.suggestedNextStep ? (
                      <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {item.suggestedNextStep}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border/50 bg-secondary/[0.18] p-4 text-sm leading-relaxed text-muted-foreground">
                  Open questions will appear here after the runtime Case Wiki hydrates.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
              {projectionTitle}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone={exportBlocked ? "rose" : "mint"} size="sm" dot>
                {exportBlocked ? exportBlockedLabel : projectionReadyLabel}
              </Pill>
              {hasRawArtifactBlocker ? (
                <Pill tone="rose" size="sm">
                  Raw artifact blocker
                </Pill>
              ) : null}
              {hasSignatureBlocker ? (
                <Pill tone="violet" size="sm">
                  Signature pending
                </Pill>
              ) : null}
              <Pill tone="slate" size="sm">
                {`${projectionLines.length} lines`}
              </Pill>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {projectionSummary} {complianceSummary}
            </p>
            {remediationHint ? (
              <div className="mt-3 rounded-2xl border border-border/50 bg-background/55 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                Next repo-owned step: <span className="text-foreground/88">{remediationHint}</span>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={projectionMode === "handoff" ? "secondary" : "ghost"}
                className="h-8 rounded-full px-3 text-[12px]"
                onClick={() => setProjectionMode("handoff")}
              >
                Operator handoff
              </Button>
              <Button
                type="button"
                variant={projectionMode === "crm" ? "secondary" : "ghost"}
                className="h-8 rounded-full px-3 text-[12px]"
                onClick={() => setProjectionMode("crm")}
              >
                CRM prep
              </Button>
            </div>
            <div className="mt-4 rounded-2xl border border-border/50 bg-secondary/[0.18] p-4">
              {projectionLines.length > 0 ? (
                <ol className="space-y-2">
                  {projectionLines.slice(0, 6).map((line, index) => (
                    <li
                      key={`${index}-${line}`}
                      className="text-sm leading-relaxed text-foreground/88"
                    >
                      {line}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="text-sm leading-relaxed text-muted-foreground">
                  Case Vault projection will appear here after the compiled Case Wiki publishes.
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="ghost" className="h-8 px-3 text-[12px]">
                <Link to={evidencePath}>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                  Open evidence
                </Link>
              </Button>
            </div>
          </article>
        </div>

        <div className="grid gap-4">
          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Evidence map
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {refFamilies.length > 0 ? (
                refFamilies.slice(0, 4).map((item) => (
                  <div
                    key={item.family}
                    className="rounded-2xl border border-border/50 bg-secondary/[0.18] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-foreground/88">
                        {formatFamilyLabel(item.family)}
                      </div>
                      <Pill tone="slate" size="sm">
                        {item.count}
                      </Pill>
                    </div>
                    <div className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {item.sample}
                    </div>
                  </div>
                ))
              ) : (
                <div className="md:col-span-2 rounded-2xl border border-border/50 bg-secondary/[0.18] p-4 text-sm leading-relaxed text-muted-foreground">
                  Source refs will appear here once compiled memory publishes linked evidence.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
              Linked entities
            </div>
            <div className="mt-4 space-y-3">
              {entities.length > 0 ? (
                entities.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border/50 bg-secondary/[0.18] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm text-foreground/88">{item.label}</div>
                      <Pill tone="slate" size="sm">
                        {formatKindLabel(item.kind, "entity")}
                      </Pill>
                      {item.role ? (
                        <Pill tone="violet" size="sm">
                          {item.role}
                        </Pill>
                      ) : null}
                    </div>
                    {item.description ? (
                      <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </div>
                    ) : null}
                    <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                      {item.sourceRefs.length > 0
                        ? `${item.sourceRefs.length} linked ref${item.sourceRefs.length === 1 ? "" : "s"}`
                        : "No linked refs"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border/50 bg-secondary/[0.18] p-4 text-sm leading-relaxed text-muted-foreground">
                  Linked entities are waiting for the first compiled Case Wiki snapshot.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Timer className="h-3.5 w-3.5" strokeWidth={1.75} />
              Recent memory trail
            </div>
            <div className="mt-4 space-y-3">
              {timeline.length > 0 ? (
                timeline.map((entry) => (
                  <div
                    key={`${entry.ts}-${entry.title}`}
                    className="rounded-2xl border border-border/50 bg-secondary/[0.18] p-3"
                  >
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {formatTimestamp(entry.ts)}
                    </div>
                    <div className="mt-2 text-sm text-foreground/88">{entry.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {entry.summary}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border/50 bg-secondary/[0.18] p-4 text-sm leading-relaxed text-muted-foreground">
                  Case Vault trail is waiting for repo-owned timeline entries.
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};
