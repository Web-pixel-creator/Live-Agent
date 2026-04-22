import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Globe,
  Radio,
  RefreshCcw,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { WorkspaceCase } from "@/data/workspace";
import { useWorkspaceRuntime } from "@/hooks/useWorkspaceRuntime";
import { fetchRuntimeApi } from "@/lib/runtime-api";

type RuntimeDiagnosticsPanelsProps = {
  caseValue: WorkspaceCase;
  embedded?: boolean;
};

type AuthProfileSummary = {
  profileId: string;
  label: string;
  category: string | null;
  activeCredentialName: string | null;
  availableCredentialNames: string[];
  effectiveSource: string | null;
  directValueConfigured: boolean | null;
  effectiveResolved: boolean | null;
  warnings: string[];
};

type BrowserJobSummary = {
  jobId: string;
  label: string | null;
  status: string | null;
  updatedAt: string | null;
  currentWorkerId: string | null;
  error: string | null;
  latestCheckpointRef: string | null;
  latestResultRef: string | null;
  nextCheckpointStep: number | null;
  verificationSummary: string | null;
  targetUrl: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toText(value: unknown, fallback = "not published"): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function toOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => toOptionalText(item))
    .filter((item): item is string => item !== null);
}

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

function formatStatusLabel(value: string | null | undefined, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.replace(/[_-]+/g, " ").trim();
}

function toneFromRuntimeStatus(
  value: string | null | undefined,
): "mint" | "rose" | "amber" | "violet" | "slate" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "healthy" || normalized === "pass" || normalized === "configured") {
    return "mint";
  }
  if (
    normalized === "critical" ||
    normalized === "blocked" ||
    normalized === "fail" ||
    normalized === "failed" ||
    normalized === "unavailable"
  ) {
    return "rose";
  }
  if (normalized === "degraded" || normalized === "warn" || normalized === "warning") {
    return "amber";
  }
  if (normalized === "running" || normalized === "active" || normalized === "pending") {
    return "violet";
  }
  return "slate";
}

async function readJsonDataRecord(
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown> | null> {
  const response = await fetchRuntimeApi(path, init);
  const payload = (await response.json().catch(() => ({}))) as {
    data?: unknown;
    error?: unknown;
  };
  if (!response.ok) {
    const error = isRecord(payload.error) ? payload.error : null;
    throw new Error(
      toOptionalText(error?.message) ??
        toOptionalText(error?.code) ??
        `${path} failed with ${response.status}`,
    );
  }
  return isRecord(payload.data) ? payload.data : null;
}

async function fetchRuntimeWorkflowControlPlane(): Promise<Record<string, unknown> | null> {
  return readJsonDataRecord("/v1/runtime/workflow-config", {
    headers: {
      "x-operator-role": "viewer",
    },
  });
}

async function clearRuntimeWorkflowControlPlaneOverride(
  caseRef: string,
): Promise<Record<string, unknown> | null> {
  return readJsonDataRecord("/v1/runtime/workflow-control-plane-override", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-operator-role": "admin",
      "x-operator-id": "action-desk-app-shell",
    },
    body: JSON.stringify({
      clear: true,
      reason: `app shell clear workflow override (${caseRef})`,
    }),
  });
}

async function fetchRuntimeBootstrapStatus(): Promise<Record<string, unknown> | null> {
  return readJsonDataRecord("/v1/runtime/bootstrap-status", {
    headers: {
      "x-operator-role": "viewer",
    },
  });
}

async function fetchRuntimeAuthProfiles(): Promise<AuthProfileSummary[]> {
  const response = await fetchRuntimeApi("/v1/runtime/auth-profiles", {
    headers: {
      "x-operator-role": "viewer",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: unknown;
    error?: unknown;
  };
  if (!response.ok) {
    const error = isRecord(payload.error) ? payload.error : null;
    throw new Error(
      toOptionalText(error?.message) ??
        toOptionalText(error?.code) ??
        `auth profiles failed with ${response.status}`,
    );
  }
  const data = isRecord(payload.data) ? payload.data : null;
  const profiles = Array.isArray(data?.profiles)
    ? data.profiles.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  return profiles.map((profile) => ({
    profileId: toText(profile.profileId, "unknown-profile"),
    label: toText(profile.label, "Unnamed profile"),
    category: toOptionalText(profile.category),
    activeCredentialName: toOptionalText(profile.activeCredentialName),
    availableCredentialNames: toStringList(profile.availableCredentialNames),
    effectiveSource: toOptionalText(profile.effectiveSource),
    directValueConfigured: toBoolean(profile.directValueConfigured),
    effectiveResolved: toBoolean(profile.effectiveResolved),
    warnings: toStringList(profile.warnings),
  }));
}

async function rotateRuntimeAuthProfile(
  profileId: string,
  nextCredentialName: string,
  caseRef: string,
): Promise<void> {
  const response = await fetchRuntimeApi("/v1/runtime/auth-profiles/rotate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-operator-role": "admin",
      "x-operator-id": "action-desk-app-shell",
    },
    body: JSON.stringify({
      profileId,
      nextCredentialName,
      reason: `app shell auth-profile rotate (${caseRef})`,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    const error = isRecord(payload.error) ? payload.error : null;
    throw new Error(
      toOptionalText(error?.message) ??
        toOptionalText(error?.code) ??
        `auth-profile rotation failed with ${response.status}`,
    );
  }
}

async function fetchRuntimeBrowserJobs(): Promise<Record<string, unknown> | null> {
  return readJsonDataRecord("/v1/runtime/browser-jobs?limit=6", {
    headers: {
      "x-operator-role": "viewer",
    },
  });
}

async function performRuntimeBrowserJobAction(
  jobId: string,
  action: "resume" | "cancel",
  caseRef: string,
): Promise<void> {
  const response = await fetchRuntimeApi(`/v1/runtime/browser-jobs/${encodeURIComponent(jobId)}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-operator-role": "operator",
      "x-operator-id": "action-desk-app-shell",
    },
    body: JSON.stringify({
      reason: `app shell browser worker ${action} (${caseRef})`,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    const error = isRecord(payload.error) ? payload.error : null;
    throw new Error(
      toOptionalText(error?.message) ??
        toOptionalText(error?.code) ??
        `browser worker ${action} failed with ${response.status}`,
    );
  }
}

function pickNextCredentialName(profile: AuthProfileSummary): string | null {
  const active = profile.activeCredentialName;
  const names = profile.availableCredentialNames;
  if (names.length <= 1) {
    return null;
  }
  if (!active) {
    return names[0] ?? null;
  }
  return names.find((item) => item !== active) ?? null;
}

function normalizeBrowserJobs(snapshot: Record<string, unknown> | null): BrowserJobSummary[] {
  const records = Array.isArray(snapshot?.jobs)
    ? snapshot.jobs.filter((item): item is Record<string, unknown> => isRecord(item))
    : Array.isArray(snapshot?.recent)
      ? snapshot.recent.filter((item): item is Record<string, unknown> => isRecord(item))
      : [];

  return records.map((job) => ({
    jobId: toText(job.jobId, "unknown-job"),
    label: toOptionalText(job.label),
    status: toOptionalText(job.status),
    updatedAt: toOptionalText(job.updatedAt),
    currentWorkerId: toOptionalText(job.currentWorkerId),
    error: toOptionalText(job.error),
    latestCheckpointRef: toOptionalText(job.latestCheckpointRef),
    latestResultRef: toOptionalText(job.latestResultRef),
    nextCheckpointStep: toNumber(job.nextCheckpointStep),
    verificationSummary: toOptionalText(job.verificationSummary),
    targetUrl: toOptionalText(job.targetUrl),
  }));
}

export const RuntimeDiagnosticsPanels = ({
  caseValue,
  embedded = false,
}: RuntimeDiagnosticsPanelsProps) => {
  const queryClient = useQueryClient();
  const {
    runtimeDiagnostics,
    bootstrapDoctor,
    browserWorkers,
  } = useWorkspaceRuntime();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const workflowQuery = useQuery({
    queryKey: ["app-shell", "workflow-control-plane"],
    queryFn: () => fetchRuntimeWorkflowControlPlane(),
    staleTime: 30_000,
    retry: 1,
  });

  const bootstrapQuery = useQuery({
    queryKey: ["app-shell", "bootstrap-status"],
    queryFn: () => fetchRuntimeBootstrapStatus(),
    staleTime: 30_000,
    retry: 1,
  });

  const authProfilesQuery = useQuery({
    queryKey: ["app-shell", "auth-profiles"],
    queryFn: () => fetchRuntimeAuthProfiles(),
    staleTime: 30_000,
    retry: 1,
  });

  const browserJobsQuery = useQuery({
    queryKey: ["app-shell", "browser-jobs"],
    queryFn: () => fetchRuntimeBrowserJobs(),
    staleTime: 30_000,
    retry: 1,
  });

  const diagnostics = isRecord(runtimeDiagnostics) ? runtimeDiagnostics : null;
  const servicesCoverage = isRecord(diagnostics?.servicesCoverage) ? diagnostics.servicesCoverage : null;
  const orchestrator = isRecord(diagnostics?.orchestrator) ? diagnostics.orchestrator : null;
  const uiExecutor = isRecord(diagnostics?.uiExecutor) ? diagnostics.uiExecutor : null;
  const skillsCatalog = isRecord(diagnostics?.skillsCatalog) ? diagnostics.skillsCatalog : null;
  const slo = isRecord(diagnostics?.slo) ? diagnostics.slo : null;
  const latestCaseWiki = isRecord(orchestrator?.latestCaseWikiRoutingContext)
    ? orchestrator.latestCaseWikiRoutingContext
    : null;
  const activeSignals = Array.isArray(diagnostics?.activeSignals)
    ? diagnostics.activeSignals.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  const topSignal = activeSignals[0] ?? null;

  const workflowSnapshot = workflowQuery.data;
  const workflowSummary = isRecord(workflowSnapshot?.summary) ? workflowSnapshot.summary : null;
  const workflowStatus =
    toOptionalText(workflowSummary?.workflowExecutionStatus) ??
    toOptionalText(orchestrator?.workflowExecutionStatus) ??
    toOptionalText(diagnostics?.status) ??
    "awaiting refresh";
  const workflowOverrideActive =
    workflowSummary?.controlPlaneOverrideActive === true ||
    orchestrator?.workflowControlPlaneOverrideActive === true;
  const workflowOverrideReason =
    toOptionalText(workflowSummary?.controlPlaneOverrideReason) ??
    toOptionalText(orchestrator?.workflowControlPlaneOverrideReason);

  const bootstrapSnapshot = bootstrapQuery.data ?? (isRecord(bootstrapDoctor) ? bootstrapDoctor : null);
  const bootstrapSummary = isRecord(bootstrapSnapshot?.summary) ? bootstrapSnapshot.summary : null;
  const bootstrapProviders = isRecord(bootstrapSummary?.providers) ? bootstrapSummary.providers : null;
  const bootstrapAuthProfiles = isRecord(bootstrapSummary?.authProfiles) ? bootstrapSummary.authProfiles : null;
  const bootstrapFallbackPaths = isRecord(bootstrapSummary?.fallbackPaths) ? bootstrapSummary.fallbackPaths : null;
  const bootstrapTopCheck = isRecord(bootstrapSummary?.topCheck) ? bootstrapSummary.topCheck : null;

  const authProfiles = authProfilesQuery.data ?? [];
  const rotatableProfiles = useMemo(
    () =>
      authProfiles
        .map((profile) => ({
          ...profile,
          nextCredentialName: pickNextCredentialName(profile),
        }))
        .filter((profile) => profile.nextCredentialName !== null)
        .slice(0, 3),
    [authProfiles],
  );

  const browserWorkerSnapshot = browserJobsQuery.data ?? (isRecord(browserWorkers) ? browserWorkers : null);
  const browserWorkerQueue = isRecord(browserWorkerSnapshot?.queue) ? browserWorkerSnapshot.queue : null;
  const browserWorkerJobs = useMemo(
    () => normalizeBrowserJobs(browserWorkerSnapshot).slice(0, 3),
    [browserWorkerSnapshot],
  );

  const refreshOperatorSummary = async () => {
    await queryClient.invalidateQueries({ queryKey: ["app-shell", "operator-summary"] });
  };

  const refreshWorkflow = async () => {
    try {
      const result = await workflowQuery.refetch();
      if (result.error) {
        throw result.error;
      }
      await refreshOperatorSummary();
      toast.success(`Workflow runtime refreshed for ${caseValue.ref}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workflow runtime refresh failed.");
    }
  };

  const clearWorkflowOverride = async () => {
    setPendingAction("workflow-clear");
    try {
      await clearRuntimeWorkflowControlPlaneOverride(caseValue.ref);
      await Promise.all([
        workflowQuery.refetch(),
        refreshOperatorSummary(),
      ]);
      toast.success(`Workflow override cleared for ${caseValue.ref}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workflow override clear failed.");
    } finally {
      setPendingAction(null);
    }
  };

  const refreshGuardrails = async () => {
    try {
      await refreshOperatorSummary();
      toast.success(`Runtime guardrails refreshed for ${caseValue.ref}`);
    } catch {
      toast.error("Runtime guardrails refresh failed.");
    }
  };

  const refreshBootstrap = async () => {
    try {
      const [bootstrapResult, authProfilesResult] = await Promise.all([
        bootstrapQuery.refetch(),
        authProfilesQuery.refetch(),
      ]);
      if (bootstrapResult.error) {
        throw bootstrapResult.error;
      }
      if (authProfilesResult.error) {
        throw authProfilesResult.error;
      }
      await refreshOperatorSummary();
      toast.success(`Bootstrap doctor refreshed for ${caseValue.ref}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bootstrap doctor refresh failed.");
    }
  };

  const rotateAuthProfileAction = async (
    profileId: string,
    nextCredentialName: string,
  ) => {
    const actionId = `rotate:${profileId}`;
    setPendingAction(actionId);
    try {
      await rotateRuntimeAuthProfile(profileId, nextCredentialName, caseValue.ref);
      await Promise.all([
        bootstrapQuery.refetch(),
        authProfilesQuery.refetch(),
        refreshOperatorSummary(),
      ]);
      toast.success(`Auth profile rotated to ${nextCredentialName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Auth profile rotation failed.");
    } finally {
      setPendingAction(null);
    }
  };

  const refreshBrowserWorkers = async () => {
    try {
      const result = await browserJobsQuery.refetch();
      if (result.error) {
        throw result.error;
      }
      await refreshOperatorSummary();
      toast.success(`Browser workers refreshed for ${caseValue.ref}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Browser worker refresh failed.");
    }
  };

  const performBrowserJobActionHandler = async (
    jobId: string,
    action: "resume" | "cancel",
  ) => {
    const actionId = `${action}:${jobId}`;
    setPendingAction(actionId);
    try {
      await performRuntimeBrowserJobAction(jobId, action, caseValue.ref);
      await Promise.all([
        browserJobsQuery.refetch(),
        refreshOperatorSummary(),
      ]);
      toast.success(`Browser worker ${action} executed for ${jobId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Browser worker ${action} failed.`);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section
      className={
        embedded
          ? "relative scroll-mt-24 pl-4 pr-1 py-2"
          : "relative mt-6 -mx-8 scroll-mt-24 px-8 py-6 bg-secondary/[0.03] border-y border-border/50"
      }
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-border/70" />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-primary mb-3">
            Runtime diagnostics
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-[30px] leading-[1.1] tracking-tight">
              Workflow, guardrails, bootstrap, workers
            </h2>
            <Pill tone={toneFromRuntimeStatus(toOptionalText(diagnostics?.status))} size="sm" dot>
              {formatStatusLabel(toOptionalText(diagnostics?.status), "awaiting refresh")}
            </Pill>
            {latestCaseWiki ? (
              <Pill tone="slate" size="sm">
                {`${toText(latestCaseWiki.contextSource)} via ${toText(latestCaseWiki.ingressSource)}`}
              </Pill>
            ) : null}
            {workflowOverrideActive ? (
              <Pill tone="amber" size="sm">
                Override active
              </Pill>
            ) : null}
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            The new app shell now keeps the legacy runtime moat inside the same operator workspace: repo-owned workflow control-plane state, runtime guardrails posture, bootstrap doctor/auth-profile readiness, and browser worker triage all live in `/app/console`.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Workflow className="h-3.5 w-3.5" strokeWidth={1.75} />
                Workflow Runtime
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="text-[15px] leading-relaxed text-foreground/92">
                  {formatStatusLabel(workflowStatus, "awaiting refresh")}
                </div>
                <Pill tone={toneFromRuntimeStatus(workflowStatus)} size="sm">
                  {formatStatusLabel(toOptionalText(workflowSummary?.workflowCurrentStage), "no stage")}
                </Pill>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" className="h-8 px-3 text-[12px]" onClick={refreshWorkflow}>
                <RefreshCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                Refresh workflow
              </Button>
              {workflowOverrideActive ? (
                <Button
                  variant="ghost"
                  className="h-8 px-3 text-[12px]"
                  onClick={clearWorkflowOverride}
                  disabled={pendingAction === "workflow-clear"}
                >
                  <RotateCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                  Clear override
                </Button>
              ) : null}
            </div>
          </div>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Route</dt>
              <dd className="text-right text-foreground/88">{toText(workflowSummary?.workflowRoute)}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Intent</dt>
              <dd className="text-right text-foreground/88">{toText(workflowSummary?.workflowIntent)}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="text-right text-foreground/88">{toText(workflowSummary?.workflowActiveRole)}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="text-right font-mono text-[11px] text-foreground/88">
                {formatTimestamp(toOptionalText(workflowSummary?.workflowUpdatedAt))}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Case Wiki ingress</dt>
              <dd className="max-w-[16rem] text-right font-mono text-[11px] text-foreground/88">
                {latestCaseWiki
                  ? `${toText(latestCaseWiki.contextSource)} via ${toText(latestCaseWiki.ingressSource)}`
                  : "not published"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 rounded-2xl border border-border/50 bg-secondary/[0.2] p-4 text-sm leading-relaxed text-muted-foreground">
            {workflowOverrideActive
              ? workflowOverrideReason ?? "Workflow control-plane override is active. Clear it from this shell when the drill or recovery step is complete."
              : toOptionalText(workflowSummary?.workflowReason) ?? "Workflow control plane is following the repo-owned baseline."}
          </div>
        </article>

        <article
          id="safety-rules"
          className="rounded-[22px] border border-border/60 bg-background/65 scroll-mt-24 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {toOptionalText(diagnostics?.status) === "critical" ? (
                  <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                Runtime Guardrails
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="text-[15px] leading-relaxed text-foreground/92">
                  {formatStatusLabel(toOptionalText(diagnostics?.status), "awaiting refresh")}
                </div>
                <Pill tone={toneFromRuntimeStatus(toOptionalText(slo?.status))} size="sm">
                  SLO {formatStatusLabel(toOptionalText(slo?.status), "missing")}
                </Pill>
              </div>
            </div>
            <Button variant="ghost" className="h-8 px-3 text-[12px]" onClick={refreshGuardrails}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Refresh guardrails
            </Button>
          </div>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Signals</dt>
              <dd className="text-right text-foreground/88">{activeSignals.length}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Coverage</dt>
              <dd className="text-right text-foreground/88">
                {`${toText(servicesCoverage?.runtimeVisible, "0")}/${toText(servicesCoverage?.total, "0")} runtime`}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Sandbox</dt>
              <dd className="text-right text-foreground/88">
                {`${toText(uiExecutor?.sandboxMode)} · ${toText(uiExecutor?.sandboxNetworkPolicy)}`}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Skills</dt>
              <dd className="text-right text-foreground/88">
                {`${toText(skillsCatalog?.readyPersonas, "0")}/${toText(skillsCatalog?.personas, "0")} ready`}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Top signal</dt>
              <dd className="max-w-[16rem] text-right font-mono text-[11px] text-foreground/88">
                {topSignal
                  ? `${toText(topSignal.key)}@${toText(topSignal.service, "runtime")}`
                  : "none"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 space-y-2">
            {activeSignals.slice(0, 3).map((signal) => (
              <div
                key={`${toText(signal.key)}-${toText(signal.service, "runtime")}`}
                className="rounded-2xl border border-border/50 bg-secondary/[0.2] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={toneFromRuntimeStatus(toOptionalText(signal.severity))} size="sm">
                    {formatStatusLabel(toOptionalText(signal.severity), "info")}
                  </Pill>
                  <div className="text-sm text-foreground/88">
                    {toText(signal.key)}
                  </div>
                </div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {toText(signal.message)}
                </div>
              </div>
            ))}
            {activeSignals.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-secondary/[0.2] p-4 text-sm leading-relaxed text-muted-foreground">
                Runtime guardrails are nominal across gateway, orchestrator, ui-executor, and skills catalog surfaces.
              </div>
            ) : null}
          </div>
        </article>

        <article
          id="health-check"
          className="rounded-[22px] border border-border/60 bg-background/65 scroll-mt-24 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Server className="h-3.5 w-3.5" strokeWidth={1.75} />
                Bootstrap Doctor
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="text-[15px] leading-relaxed text-foreground/92">
                  {formatStatusLabel(toOptionalText(bootstrapSnapshot?.status), "awaiting refresh")}
                </div>
                {bootstrapTopCheck ? (
                  <Pill tone={toneFromRuntimeStatus(toOptionalText(bootstrapTopCheck.status))} size="sm">
                    {toText(bootstrapTopCheck.id)}
                  </Pill>
                ) : null}
              </div>
            </div>
            <Button variant="ghost" className="h-8 px-3 text-[12px]" onClick={refreshBootstrap}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Refresh doctor
            </Button>
          </div>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Providers</dt>
              <dd className="text-right text-foreground/88">
                {`${toText(bootstrapProviders?.configured, "0")}/${toText(bootstrapProviders?.total, "0")} configured`}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Auth profiles</dt>
              <dd className="text-right text-foreground/88">
                {`${toText(bootstrapAuthProfiles?.ready, "0")}/${toText(bootstrapAuthProfiles?.total, "0")} ready`}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Fallback paths</dt>
              <dd className="text-right text-foreground/88">
                {`${toText(bootstrapFallbackPaths?.readyCount, "0")}/${toText(bootstrapFallbackPaths?.total, "0")} ready`}
              </dd>
            </div>
          </dl>
          <div className="mt-4 rounded-2xl border border-border/50 bg-secondary/[0.2] p-4 text-sm leading-relaxed text-muted-foreground">
            {bootstrapTopCheck
              ? `${toText(bootstrapTopCheck.title)} · ${toText(bootstrapTopCheck.message)}`
              : "Bootstrap doctor is waiting for the first refresh."}
          </div>
          <div className="mt-4 space-y-2">
            {rotatableProfiles.map((profile) => (
              <div
                key={profile.profileId}
                className="rounded-2xl border border-border/50 bg-background/65 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm text-foreground/88">{profile.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {`${profile.profileId} · ${profile.category ?? "profile"}`}
                    </div>
                  </div>
                  <Pill tone={profile.effectiveResolved ? "mint" : "amber"} size="sm">
                    {profile.activeCredentialName ?? profile.effectiveSource ?? "unresolved"}
                  </Pill>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-[12px]"
                    onClick={() =>
                      profile.nextCredentialName
                        ? rotateAuthProfileAction(profile.profileId, profile.nextCredentialName)
                        : undefined
                    }
                    disabled={
                      !profile.nextCredentialName ||
                      pendingAction === `rotate:${profile.profileId}`
                    }
                  >
                    <RotateCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                    Rotate next credential
                  </Button>
                  {profile.warnings.length > 0 ? (
                    <Pill tone="amber" size="sm">
                      {profile.warnings.length} warning
                      {profile.warnings.length === 1 ? "" : "s"}
                    </Pill>
                  ) : null}
                </div>
              </div>
            ))}
            {rotatableProfiles.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-background/65 p-4 text-sm leading-relaxed text-muted-foreground">
                No auth-profile rotation target is published yet. Refresh doctor after credentials or profiles change.
              </div>
            ) : null}
          </div>
        </article>

        <article className="rounded-[22px] border border-border/60 bg-background/65 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
                Browser Workers
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="text-[15px] leading-relaxed text-foreground/92">
                  {`${toText(browserWorkerQueue?.running, "0")} running · ${toText(browserWorkerQueue?.paused, "0")} paused`}
                </div>
                <Pill tone={toneFromRuntimeStatus(toOptionalText(browserWorkerSnapshot?.status))} size="sm">
                  {formatStatusLabel(toOptionalText(browserWorkerSnapshot?.status), "runtime")}
                </Pill>
              </div>
            </div>
            <Button variant="ghost" className="h-8 px-3 text-[12px]" onClick={refreshBrowserWorkers}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Refresh workers
            </Button>
          </div>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Queued</dt>
              <dd className="text-right text-foreground/88">{toText(browserWorkerQueue?.queued, "0")}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Failed</dt>
              <dd className="text-right text-foreground/88">{toText(browserWorkerQueue?.failed, "0")}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted-foreground">Checkpoint ready</dt>
              <dd className="text-right text-foreground/88">{toText(browserWorkerQueue?.checkpointReady, "0")}</dd>
            </div>
          </dl>
          <div className="mt-4 space-y-2">
            {browserWorkerJobs.map((job) => {
              const canResume = job.status?.toLowerCase() === "paused";
              const canCancel = ["queued", "running", "paused"].includes(job.status?.toLowerCase() ?? "");
              return (
                <div key={job.jobId} className="rounded-2xl border border-border/50 bg-background/65 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm text-foreground/88">
                        {job.label ?? job.jobId}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {`${job.jobId} · ${formatTimestamp(job.updatedAt)}`}
                      </div>
                    </div>
                    <Pill tone={toneFromRuntimeStatus(job.status)} size="sm">
                      {formatStatusLabel(job.status, "unknown")}
                    </Pill>
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {job.verificationSummary ??
                      job.error ??
                      job.targetUrl ??
                      "Browser worker queue is waiting for more replay evidence."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canResume ? (
                      <Button
                        variant="ghost"
                        className="h-8 px-3 text-[12px]"
                        onClick={() => performBrowserJobActionHandler(job.jobId, "resume")}
                        disabled={pendingAction === `resume:${job.jobId}`}
                      >
                        <RefreshCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                        Resume job
                      </Button>
                    ) : null}
                    {canCancel ? (
                      <Button
                        variant="ghost"
                        className="h-8 px-3 text-[12px]"
                        onClick={() => performBrowserJobActionHandler(job.jobId, "cancel")}
                        disabled={pendingAction === `cancel:${job.jobId}`}
                      >
                        <AlertTriangle className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                        Cancel job
                      </Button>
                    ) : null}
                    {job.currentWorkerId ? (
                      <Pill tone="slate" size="sm">
                        {job.currentWorkerId}
                      </Pill>
                    ) : null}
                    {job.latestCheckpointRef ? (
                      <Pill tone="violet" size="sm">
                        checkpoint
                      </Pill>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {browserWorkerJobs.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-background/65 p-4 text-sm leading-relaxed text-muted-foreground">
                Browser worker runtime is waiting for the first queue snapshot.
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
};
