import type { WorkspaceCase } from "../data/workspace";

type CaseArtifactTarget =
  | Pick<WorkspaceCase, "ref" | "caseId" | "sessionId">
  | string
  | null
  | undefined;

function firstArtifactToken(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function resolveCaseArtifactRef(
  target: CaseArtifactTarget,
): string | null {
  if (typeof target === "string") {
    return firstArtifactToken(target);
  }
  if (!target) {
    return null;
  }
  return firstArtifactToken(target.caseId, target.sessionId, target.ref);
}

export function buildCaseBundlePath(target: CaseArtifactTarget): string {
  const ref = resolveCaseArtifactRef(target);
  return ref ? `/bundle/${encodeURIComponent(ref)}` : "/bundle";
}

export function buildCaseEvidencePath(target: CaseArtifactTarget): string {
  const ref = resolveCaseArtifactRef(target);
  return ref ? `/evidence/${encodeURIComponent(ref)}` : "/evidence";
}

export function buildCaseRuntimeSupportPath(
  target: CaseArtifactTarget,
  hash?: string | null,
): string {
  const ref = resolveCaseArtifactRef(target);
  const search = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const anchor =
    typeof hash === "string" && hash.trim().length > 0
      ? `#${hash.replace(/^#/, "").trim()}`
      : "";
  return `/app/console/runtime${search}${anchor}`;
}

export function buildCaseVaultPath(target: CaseArtifactTarget): string {
  return buildCaseRuntimeSupportPath(target, "case-vault");
}
