import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readAppShellSource(relativePath: string): string {
  return readFileSync(
    resolve(process.cwd(), "apps", "demo-frontend", "app-shell", "src", ...relativePath.split("/")),
    "utf8",
  );
}

function readRepoSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), ...relativePath.split("/")), "utf8");
}

test("app shell wraps routes with the workspace runtime provider", () => {
  const source = readAppShellSource("App.tsx");

  assert.match(source, /import \{ WorkspaceRuntimeProvider \} from "@\/hooks\/useWorkspaceRuntime";/);
  assert.match(source, /<WorkspaceRuntimeProvider>/);
  assert.match(source, /<\/WorkspaceRuntimeProvider>/);
  assert.match(source, /<Route path="\/app\/console\/runtime" element=\{<ConsoleRuntime \/>} \/>/);
});

test("live desk and console surfaces prefer repo-owned runtime data with draft fallback support", () => {
  const liveDesk = readAppShellSource("components/workspace/LiveDesk.tsx");
  const consoleStage = readAppShellSource("components/workspace/ConsoleStage.tsx");
  const consoleRuntime = readAppShellSource("pages/ConsoleRuntime.tsx");
  const caseWikiPanel = readAppShellSource("components/workspace/CaseWikiPanel.tsx");
  const caseVaultPanel = readAppShellSource("components/workspace/CaseVaultPanel.tsx");
  const runtimeDiagnosticsPanels = readAppShellSource("components/workspace/RuntimeDiagnosticsPanels.tsx");
  const sessionBoundaryPanel = readAppShellSource("components/workspace/SessionBoundaryPanel.tsx");
  const sessionOpsPanel = readAppShellSource("components/workspace/SessionOpsPanel.tsx");
  const artifactViewerPanel = readAppShellSource("components/workspace/ArtifactViewerPanel.tsx");
  const artifactViewerLib = readAppShellSource("lib/runtime-artifact-viewer.ts");
  const replayRuntime = readAppShellSource("lib/runtime-session-replay.ts");
  const workspaceRuntime = readAppShellSource("hooks/useWorkspaceRuntime.tsx");
  const consolePage = readAppShellSource("pages/Console.tsx");
  const bundlePage = readAppShellSource("pages/Bundle.tsx");
  const evidenceDetailPage = readAppShellSource("pages/EvidenceDetail.tsx");

  assert.match(liveDesk, /const \{ cases, deviceNodes, addDraftCase \} = useWorkspaceRuntime\(\);/);
  assert.match(liveDesk, /existingCases=\{cases\}/);
  assert.match(liveDesk, /addDraftCase\(draft\);/);
  assert.match(liveDesk, /deviceNodes\.find\(\(n\) => n\.id === nodeFilterId\)/);
  assert.match(liveDesk, /buildCaseVaultPath/);
  assert.match(liveDesk, /Open Case Vault/);
  assert.match(liveDesk, /handleOpenCaseVault/);

  assert.match(consoleStage, /const \{ deviceNodes, getCaseByRef, getCaseWikiByRef \} = useWorkspaceRuntime\(\);/);
  assert.match(consoleStage, /const baseCase = getCaseByRef\(caseRef\);/);
  assert.match(consoleStage, /deviceNodes\.find\(\(n\) => n\.id === c\.sourceNodeId\)/);
  assert.match(consoleStage, /buildCaseVaultPath/);
  assert.match(consoleStage, /buildCaseRuntimeSupportPath/);
  assert.match(consoleStage, /handleOpenCaseVault/);
  assert.match(consoleStage, /label="Open Case Vault"/);
  assert.match(consoleStage, /Runtime support/);
  assert.match(consoleStage, /const showRuntimeSupportStrip = runtimeSupportItems\.length > 0;/);
  assert.match(consoleStage, /if \(exportReady !== true\)/);
  assert.match(consoleStage, /if \(!proofPublished\)/);
  assert.match(consoleStage, /if \(replayNeedsAttention\)/);
  assert.match(consoleStage, /const runtimeSupportCta = exportReady !== true/);
  assert.match(consoleStage, /Inspect compliance blocker/);
  assert.match(consoleStage, /Inspect raw artifact blocker/);
  assert.match(consoleStage, /Inspect signature pending/);
  assert.match(consoleStage, /Inspect unsigned proof/);
  assert.match(consoleStage, /const signatureStatus = wiki\?\.evidenceSignature\?\.status \?\? null;/);
  assert.match(consoleStage, /const compliancePrimaryAction = complianceRemediation\?\.primaryAction \?\? null;/);
  assert.match(consoleStage, /const hasRawArtifactBlocker =/);
  assert.match(consoleStage, /const hasSignatureBlocker =/);
  assert.match(consoleStage, /function formatRuntimeSupportRef/);
  assert.match(consoleStage, /const runtimeSupportHint = exportReady !== true/);
  assert.match(consoleStage, /operatorActionLabel/);
  assert.match(consoleStage, /blockingRef/);
  assert.match(consoleStage, /id="action-queue"/);
  assert.match(consoleStage, /id="live-activity"/);
  assert.doesNotMatch(consoleStage, /SessionBoundaryPanel/);
  assert.doesNotMatch(consoleStage, /CaseWikiPanel/);
  assert.doesNotMatch(consoleStage, /SessionOpsPanel/);
  assert.doesNotMatch(consoleStage, /RuntimeDiagnosticsPanels/);
  assert.match(consoleRuntime, /const \{ defaultConsoleCaseRef, getCaseByRef, getCaseWikiByRef \} = useWorkspaceRuntime\(\);/);
  assert.match(consoleRuntime, /<Topbar section="Operator Runtime" caseRef=\{caseRef\} \/>/);
  assert.match(consoleRuntime, /<SessionBoundaryPanel caseValue=\{runtimeCase\} wiki=\{wiki\} \/>/);
  assert.match(consoleRuntime, /<CaseWikiPanel caseValue=\{runtimeCase\} wiki=\{wiki\} \/>/);
  assert.match(consoleRuntime, /<CaseVaultPanel caseValue=\{runtimeCase\} wiki=\{wiki\} \/>/);
  assert.match(consoleRuntime, /<SessionOpsPanel caseValue=\{runtimeCase\} wiki=\{wiki\} \/>/);
  assert.match(consoleRuntime, /<RuntimeDiagnosticsPanels caseValue=\{runtimeCase\} \/>/);
  assert.match(consoleRuntime, /const initialArtifactPath = params\.get\("artifact"\);/);
  assert.match(consoleRuntime, /<ArtifactViewerPanel initialArtifactPath=\{initialArtifactPath\} \/>/);
  assert.match(consoleRuntime, /navigate\(`\/app\/console\$\{search \? `\?\$\{search\}` : ""\}\$\{hash\}`/);
  assert.match(caseWikiPanel, /Copy handoff/);
  assert.match(caseWikiPanel, /Copy refs/);
  assert.match(caseWikiPanel, /Open bundle/);
  assert.match(caseWikiPanel, /Open evidence/);
  assert.match(caseWikiPanel, /Inspect proof/);
  assert.match(caseWikiPanel, /Open Case Vault/);
  assert.match(caseWikiPanel, /id="case-wiki"/);
  assert.match(caseWikiPanel, /buildCaseVaultPath/);
  assert.match(caseWikiPanel, /buildRuntimeArtifactViewerPath/);
  assert.match(caseWikiPanel, /RUNTIME_ARTIFACT_VIEW_PRESETS\.runtimeProof/);
  assert.match(caseWikiPanel, /exportReady === false/);
  assert.match(caseWikiPanel, /operatorPreviewPack\?\.remediation\?\.draft/);
  assert.match(caseWikiPanel, /compliance\?\.enforcement\?\.summary/);
  assert.match(caseWikiPanel, /evidenceSignature\?\.status/);
  assert.match(workspaceRuntime, /blockingReasons\?: string\[\] \| null;/);
  assert.match(workspaceRuntime, /primaryAction\?: \{/);
  assert.match(caseVaultPanel, /id="case-vault"/);
  assert.match(caseVaultPanel, /Inspectable memory projection/);
  assert.match(caseVaultPanel, /Rowboat-style/);
  assert.match(caseVaultPanel, /Memory anchors/);
  assert.match(caseVaultPanel, /Open threads/);
  assert.match(caseVaultPanel, /Evidence map/);
  assert.match(caseVaultPanel, /Linked entities/);
  assert.match(caseVaultPanel, /Recent memory trail/);
  assert.match(caseVaultPanel, /Operator handoff/);
  assert.match(caseVaultPanel, /CRM prep/);
  assert.match(caseVaultPanel, /Operator handoff projection/);
  assert.match(caseVaultPanel, /CRM prep projection/);
  assert.match(caseVaultPanel, /Copy memory/);
  assert.match(caseVaultPanel, /Copy handoff/);
  assert.match(caseVaultPanel, /Copy CRM prep/);
  assert.match(caseVaultPanel, /Export Markdown/);
  assert.match(caseVaultPanel, /Export CRM Markdown/);
  assert.match(caseVaultPanel, /Open bundle/);
  assert.match(caseVaultPanel, /Open evidence/);
  assert.match(caseVaultPanel, /Case Vault handoff ready/);
  assert.match(caseVaultPanel, /Case Vault export blocked/);
  assert.match(caseVaultPanel, /Case Vault CRM prep ready/);
  assert.match(caseVaultPanel, /Case Vault CRM prep blocked/);
  assert.match(caseVaultPanel, /Inspect proof/);
  assert.match(sessionBoundaryPanel, /Session Boundary/);
  assert.match(sessionBoundaryPanel, /id="connections"/);
  assert.match(sessionBoundaryPanel, /fetchRuntimeSessionReplay/);
  assert.match(sessionBoundaryPanel, /buildRuntimeSessionReplaySummary/);
  assert.match(sessionBoundaryPanel, /buildRuntimeArtifactViewerPath/);
  assert.match(sessionBoundaryPanel, /RUNTIME_ARTIFACT_VIEW_PRESETS\.runtimeProof/);
  assert.match(sessionBoundaryPanel, /Inspect proof/);
  assert.match(sessionBoundaryPanel, /Proof ingress:/);
  assert.match(sessionBoundaryPanel, /Turn ingress:/);
  assert.match(sessionBoundaryPanel, /After refresh/);
  assert.match(sessionOpsPanel, /Operator Session Ops/);
  assert.match(sessionOpsPanel, /id="session-ops"/);
  assert.match(sessionOpsPanel, /Export Markdown/);
  assert.match(sessionOpsPanel, /Export JSON/);
  assert.match(sessionOpsPanel, /Refresh replay/);
  assert.match(sessionOpsPanel, /Refresh Case Wiki/);
  assert.match(sessionOpsPanel, /buildRuntimeArtifactViewerPath/);
  assert.match(sessionOpsPanel, /RUNTIME_ARTIFACT_VIEW_PRESETS\.manifest/);
  assert.match(sessionOpsPanel, /Inspect manifest/);
  assert.match(sessionOpsPanel, /buildSessionExportPayload/);
  assert.match(sessionOpsPanel, /buildSessionExportMarkdown/);
  assert.match(sessionOpsPanel, /case wiki export blocked/);
  assert.match(replayRuntime, /export async function fetchRuntimeSessionReplay/);
  assert.match(replayRuntime, /export function buildRuntimeSessionReplaySummary/);
  assert.match(replayRuntime, /export function buildSessionExportPayload/);
  assert.match(replayRuntime, /export function buildSessionExportMarkdown/);
  assert.match(replayRuntime, /latestProofIngressSource/);
  assert.match(replayRuntime, /primaryStepRefreshFollowupPath/);
  assert.match(runtimeDiagnosticsPanels, /Workflow Runtime/);
  assert.match(runtimeDiagnosticsPanels, /Runtime Guardrails/);
  assert.match(runtimeDiagnosticsPanels, /Bootstrap Doctor/);
  assert.match(runtimeDiagnosticsPanels, /Browser Workers/);
  assert.match(runtimeDiagnosticsPanels, /id="safety-rules"/);
  assert.match(runtimeDiagnosticsPanels, /id="health-check"/);
  assert.match(runtimeDiagnosticsPanels, /readJsonDataRecord\(\s*"\/v1\/runtime\/workflow-config"/);
  assert.match(runtimeDiagnosticsPanels, /readJsonDataRecord\(\s*"\/v1\/runtime\/workflow-control-plane-override"/);
  assert.match(runtimeDiagnosticsPanels, /readJsonDataRecord\(\s*"\/v1\/runtime\/bootstrap-status"/);
  assert.match(runtimeDiagnosticsPanels, /fetchRuntimeApi\(\s*"\/v1\/runtime\/auth-profiles"/);
  assert.match(runtimeDiagnosticsPanels, /fetchRuntimeApi\(\s*"\/v1\/runtime\/auth-profiles\/rotate"/);
  assert.match(runtimeDiagnosticsPanels, /readJsonDataRecord\(\s*"\/v1\/runtime\/browser-jobs\?limit=6"/);
  assert.match(runtimeDiagnosticsPanels, /buildRuntimeArtifactViewerPath/);
  assert.match(runtimeDiagnosticsPanels, /RUNTIME_ARTIFACT_VIEW_PRESETS\.report/);
  assert.match(runtimeDiagnosticsPanels, /RUNTIME_ARTIFACT_VIEW_PRESETS\.badgeDetails/);
  assert.match(runtimeDiagnosticsPanels, /Refresh workflow/);
  assert.match(runtimeDiagnosticsPanels, /Inspect report/);
  assert.match(runtimeDiagnosticsPanels, /Clear override/);
  assert.match(runtimeDiagnosticsPanels, /Refresh guardrails/);
  assert.match(runtimeDiagnosticsPanels, /Inspect badge/);
  assert.match(runtimeDiagnosticsPanels, /Refresh doctor/);
  assert.match(runtimeDiagnosticsPanels, /Rotate next credential/);
  assert.match(runtimeDiagnosticsPanels, /Refresh workers/);
  assert.match(runtimeDiagnosticsPanels, /Resume job/);
  assert.match(runtimeDiagnosticsPanels, /Cancel job/);
  assert.match(artifactViewerPanel, /id="artifact-viewer"/);
  assert.match(artifactViewerPanel, /Euphony-inspired/);
  assert.match(artifactViewerPanel, /fetchRuntimeArtifactIndex/);
  assert.match(artifactViewerPanel, /fetchRuntimeArtifactDocument/);
  assert.match(artifactViewerPanel, /Open raw/);
  assert.match(artifactViewerPanel, /Copy JSON/);
  assert.match(artifactViewerPanel, /Quick views/);
  assert.match(artifactViewerPanel, /Structured snapshot/);
  assert.match(artifactViewerPanel, /initialArtifactPath\?: string \| null;/);
  assert.match(artifactViewerPanel, /entry\.relativePath === initialArtifactPath/);
  assert.match(artifactViewerLib, /export async function fetchRuntimeArtifactIndex/);
  assert.match(artifactViewerLib, /export async function fetchRuntimeArtifactDocument/);
  assert.match(artifactViewerLib, /export function summarizeRuntimeArtifact/);
  assert.match(artifactViewerLib, /export const PINNED_RUNTIME_ARTIFACT_PATHS = \[/);
  assert.match(artifactViewerLib, /export const RUNTIME_ARTIFACT_VIEW_PRESETS = \{/);
  assert.match(artifactViewerLib, /export function isPinnedRuntimeArtifactPath/);
  assert.match(artifactViewerLib, /export function buildRuntimeArtifactViewerPath/);
  assert.match(artifactViewerLib, /export function buildRuntimeArtifactStructuredView/);
  assert.match(artifactViewerLib, /Unified release evidence report/);
  assert.match(artifactViewerLib, /Runtime proof lanes/);
  assert.match(bundlePage, /Inspect report/);
  assert.match(bundlePage, /RUNTIME_ARTIFACT_VIEW_PRESETS\.report/);
  assert.match(bundlePage, /buildRuntimeArtifactViewerPath/);
  assert.match(evidenceDetailPage, /Inspect badge details/);
  assert.match(evidenceDetailPage, /RUNTIME_ARTIFACT_VIEW_PRESETS\.badgeDetails/);
  assert.match(evidenceDetailPage, /buildRuntimeArtifactViewerPath/);

  assert.match(consolePage, /const \{ defaultConsoleCaseRef \} = useWorkspaceRuntime\(\);/);
  assert.match(consolePage, /const \{ hash \} = useLocation\(\);/);
  assert.match(consolePage, /const navigate = useNavigate\(\);/);
  assert.match(consolePage, /navigate\(`\/app\/console\/runtime\$\{search \? `\?\$\{search\}` : ""\}\$\{hash\}`/);
  assert.match(consolePage, /document\s*\.getElementById\(targetId\)\s*\?\.scrollIntoView/);
  assert.match(consolePage, /const caseRef = params\.get\("ref"\) \|\| defaultConsoleCaseRef \|\| "VS-2841";/);
});

test("shared app shell chrome reads runtime-backed counts, nodes, and diagnostics", () => {
  const topbar = readAppShellSource("components/workspace/Topbar.tsx");
  const sidebar = readAppShellSource("components/workspace/AppSidebar.tsx");
  const palette = readAppShellSource("components/workspace/CommandPalette.tsx");
  const rail = readAppShellSource("components/workspace/RuntimeRail.tsx");
  const nodeDetailRail = readAppShellSource("components/nodes/NodeDetailRail.tsx");

  assert.match(topbar, /const \{ runtimeActive, slaBurningCases, degradedInfraCases \} = useWorkspaceRuntime\(\);/);
  assert.match(topbar, /runtime · \{runtimeActive \? "live" : "mock"\}/);

  assert.match(sidebar, /const \{\s+cases,\s+deviceNodes,\s+pendingApprovals,\s+activeCaseCount,\s+pendingApprovalCount,/);
  assert.match(sidebar, /const runtimeSections: Section\[\] = \[/);
  assert.match(sidebar, /const runtimeOperatorSurfaces = operatorSurfaces\.map/);
  assert.match(sidebar, /Live activity", icon: Activity, url: "\/app"/);
  assert.match(sidebar, /Connections", icon: Plug, url: "\/app\/nodes"/);
  assert.match(sidebar, /Action queue"[\s\S]*url: "\/app\/console"/);
  assert.match(sidebar, /Safety rules", icon: ShieldCheck, url: "\/app\/simulation"/);
  assert.match(sidebar, /Health check", icon: HeartPulse, url: "\/app\/nodes"/);
  assert.match(sidebar, /const \{ pathname, hash \} = useLocation\(\);/);
  assert.match(sidebar, /pathname\.startsWith\("\/app\/console"\)/);
  assert.match(sidebar, /\/app\/console\?ref=\$\{encodeURIComponent\(firstPendingRef\)\}/);

  assert.match(palette, /const \{ cases, pendingApprovals \} = useWorkspaceRuntime\(\);/);
  assert.match(palette, /run\(\(\) => navigate\("\/app\/nodes"\)\)/);
  assert.match(palette, /run\(\(\) => navigate\("\/app\/console\/runtime"\)\)/);
  assert.match(palette, /run\(\(\) => navigate\("\/app\/console\/runtime#artifact-viewer"\)\)/);

  assert.match(rail, /const \{\s+runtimeActive,\s+pendingApprovalCount,\s+runtimeDiagnostics,\s+bootstrapDoctor,\s+browserWorkers,\s+\} = useWorkspaceRuntime\(\);/);
  assert.match(rail, /const items: RailItem\[\] = runtimeActive/);

  assert.match(nodeDetailRail, /const \{ cases \} = useWorkspaceRuntime\(\);/);
  assert.match(nodeDetailRail, /cases\.filter\(\(c\) => c\.sourceNodeId === node\.id\)/);
});

test("runtime app shell resolves backend endpoints through runtime config and shared node helpers", () => {
  const workspaceRuntime = readAppShellSource("hooks/useWorkspaceRuntime.tsx");
  const runtimeNodes = readAppShellSource("lib/runtime-device-nodes.ts");
  const nodesPage = readAppShellSource("pages/Nodes.tsx");

  assert.match(workspaceRuntime, /import \{ fetchRuntimeApi \} from "@\/lib\/runtime-api";/);
  assert.match(workspaceRuntime, /fetchRuntimeApi\(\s*"\/v1\/operator\/summary"/);
  assert.match(workspaceRuntime, /fetchRuntimeApi\(\s*"\/v1\/governance\/policy"/);
  assert.match(workspaceRuntime, /fetchRuntimeApi\(\s*"\/v1\/sessions\?limit=8"/);
  assert.match(workspaceRuntime, /fetchRuntimeApi\(\s*`\/v1\/runtime\/case-wiki\?sessionId=\$\{encodeURIComponent\(sessionId\)\}`/);

  assert.match(runtimeNodes, /import \{ fetchRuntimeApi \} from "@\/lib\/runtime-api";/);
  assert.match(runtimeNodes, /fetchRuntimeApi\(\s*"\/v1\/device-nodes\?includeOffline=true&limit=200"/);

  assert.match(nodesPage, /import \{\s*fetchRuntimeDeviceNodes,\s*mapRuntimeDeviceNode,\s*\} from "@\/lib\/runtime-device-nodes";/);
  assert.doesNotMatch(nodesPage, /async function fetchRuntimeDeviceNodes\(\)/);
});

test("live desk, operator console, and simulation drilldowns share case-driven judge artifact links", () => {
  const helper = readAppShellSource("lib/case-artifact-links.ts");
  const liveDesk = readAppShellSource("components/workspace/LiveDesk.tsx");
  const consoleStage = readAppShellSource("components/workspace/ConsoleStage.tsx");
  const runDetailDrawer = readAppShellSource("components/workspace/RunDetailDrawer.tsx");
  const readme = readRepoSource("README.md");
  const operatorGuide = readRepoSource("docs/operator-guide.md");

  assert.match(helper, /export function resolveCaseArtifactRef/);
  assert.match(helper, /return firstArtifactToken\(target\.caseId, target\.sessionId, target\.ref\);/);
  assert.match(helper, /export function buildCaseBundlePath/);
  assert.match(helper, /export function buildCaseEvidencePath/);
  assert.match(helper, /export function buildCaseRuntimeSupportPath/);
  assert.match(helper, /return `\/app\/console\/runtime\$\{search\}\$\{anchor\}`;/);

  assert.match(liveDesk, /import \{\s*buildCaseBundlePath,\s*buildCaseEvidencePath,\s*buildCaseVaultPath,\s*\} from "@\/lib\/case-artifact-links";/);
  assert.match(liveDesk, /navigate\(buildCaseBundlePath\(value\)\);/);
  assert.match(liveDesk, /navigate\(buildCaseEvidencePath\(value\)\);/);
  assert.match(liveDesk, /navigate\(buildCaseVaultPath\(value\)\);/);

  assert.match(consoleStage, /import \{\s*buildCaseBundlePath,\s*buildCaseEvidencePath,\s*buildCaseRuntimeSupportPath,\s*buildCaseVaultPath,\s*\} from "@\/lib\/case-artifact-links";/);
  assert.match(consoleStage, /import \{ useQuery \} from "@tanstack\/react-query";/);
  assert.match(consoleStage, /import \{\s*buildRuntimeSessionReplaySummary,\s*fetchRuntimeSessionReplay,\s*type RuntimeSessionReplaySummary,\s*\} from "@\/lib\/runtime-session-replay";/);
  assert.match(consoleStage, /const \{ deviceNodes, getCaseByRef, getCaseWikiByRef \} = useWorkspaceRuntime\(\);/);
  assert.match(consoleStage, /navigate\(buildCaseBundlePath\(c\)\);/);
  assert.match(consoleStage, /navigate\(buildCaseEvidencePath\(c\)\);/);
  assert.match(consoleStage, /navigate\(buildCaseVaultPath\(c\)\);/);
  assert.match(consoleStage, /const runtimeSupportPath = buildCaseRuntimeSupportPath\(c\);/);
  assert.match(consoleStage, /Runtime support/);
  assert.match(consoleStage, /Export blocked|Export ready|Export waiting/);
  assert.match(consoleStage, /Proof signed|Proof published|Proof pending/);
  assert.match(consoleStage, /Replay loading|Replay waiting/);
  assert.match(consoleStage, /Gate pending/);
  assert.match(consoleStage, /showRuntimeSupportStrip \? \(/);
  assert.match(consoleStage, /Inspect compliance blocker|Inspect export block|Inspect export posture|Inspect unsigned proof|Inspect missing proof|Inspect replay gate|Inspect replay/);

  assert.match(runDetailDrawer, /import \{\s*buildCaseBundlePath,\s*buildCaseEvidencePath,\s*\} from "@\/lib\/case-artifact-links";/);
  assert.match(runDetailDrawer, /navigate\(buildCaseBundlePath\(c \?\? run\.caseRef\)\);/);
  assert.match(runDetailDrawer, /navigate\(buildCaseEvidencePath\(c \?\? run\.caseRef\)\);/);

  assert.match(readme, /Live Desk` row actions\/context menus and `Operator Console` hero quick actions/);
  assert.match(readme, /\/bundle\/:id` and `\/evidence\/:id` prefer runtime `caseId\/sessionId` targets/);
  assert.match(operatorGuide, /Operator proof-link note:/);
  assert.match(operatorGuide, /Presentation Bundle` \/ `Visual Evidence` targets through the same repo-owned `caseId\/sessionId\/ref` resolver/);
});

test("simulation lab prefers runtime governance metadata for the live policy snapshot", () => {
  const workspaceRuntime = readAppShellSource("hooks/useWorkspaceRuntime.tsx");
  const runtimePolicies = readAppShellSource("lib/runtime-simulation-policies.ts");
  const simulationLab = readAppShellSource("components/workspace/SimulationLab.tsx");
  const newReplaySheet = readAppShellSource("components/workspace/NewReplaySheet.tsx");
  const runDetailDrawer = readAppShellSource("components/workspace/RunDetailDrawer.tsx");
  const policyBlurb = readAppShellSource("components/workspace/runDetail/PolicyBlurb.tsx");
  const readme = readRepoSource("README.md");
  const operatorGuide = readRepoSource("docs/operator-guide.md");

  assert.match(workspaceRuntime, /governancePolicy: RuntimeGovernancePolicy \| null;/);
  assert.match(workspaceRuntime, /governanceTemplateCatalog: RuntimeGovernanceTemplateCatalog \| null;/);
  assert.match(workspaceRuntime, /governancePolicyUpdates: RuntimeGovernancePolicyUpdate\[\];/);
  assert.match(workspaceRuntime, /promoteGovernancePolicyTemplate: \(/);
  assert.match(workspaceRuntime, /fetchRuntimeApi\(\s*"\/v1\/governance\/policy"/);
  assert.match(workspaceRuntime, /fetchRuntimeApi\(\s*"\/v1\/governance\/compliance-template"/);
  assert.match(workspaceRuntime, /fetchRuntimeApi\(\s*`\/v1\/governance\/policy\/\$\{encodeURIComponent\(tenantId\)\}\/updates\?limit=12`/);
  assert.match(workspaceRuntime, /fetchRuntimeApi\(\s*"\/v1\/governance\/policy",\s*\{\s*method: "POST"/);
  assert.match(workspaceRuntime, /"x-operator-role": "admin"/);

  assert.match(runtimePolicies, /export function buildSimulationPolicySnapshots/);
  assert.match(runtimePolicies, /const TEMPLATE_POLICY_PREFIX = "policy-template-";/);
  assert.match(runtimePolicies, /function buildRuntimeTemplatePolicyId/);
  assert.match(runtimePolicies, /Template \$\{template\} from \$\{source\}/);
  assert.match(runtimePolicies, /Promote to live to apply it to the operator desk/i);

  assert.match(simulationLab, /governanceTemplateCatalog,/);
  assert.match(simulationLab, /governancePolicyUpdates,/);
  assert.match(simulationLab, /buildSimulationPolicySnapshots\(\s*governancePolicy,\s*governanceTemplateCatalog,\s*governancePolicyUpdates,\s*\)/);
  assert.match(simulationLab, /buildRuntimeSimulationRuns\(cases, policies\)/);
  assert.match(simulationLab, /findCase,/);
  assert.match(simulationLab, /const c = findCase\(run\.caseRef\);/);
  assert.match(newReplaySheet, /policies: PolicySnapshot\[\];/);
  assert.match(newReplaySheet, /policies\.find\(\(policy\) => policy\.id === policyId\)/);
  assert.match(runDetailDrawer, /policies: PolicySnapshot\[\];/);
  assert.match(runDetailDrawer, /findSimulationPolicy\(run\.policyId, policies\)/);
  assert.match(runDetailDrawer, /promoteGovernancePolicyTemplate/);
  assert.match(runDetailDrawer, /Live policy updated to/);
  assert.match(policyBlurb, /policy: PolicySnapshot \| null \| undefined/);
  assert.match(policyBlurb, /Recent governance activity/);

  assert.match(readme, /Simulation Lab` now also overlays the live `policy-current` snapshot/i);
  assert.match(readme, /repo-owned governance runtime data \(`\/v1\/governance\/policy`\)/i);
  assert.match(readme, /`\/v1\/governance\/compliance-template`/i);
  assert.match(readme, /`POST \/v1\/governance\/policy`/i);
  assert.match(operatorGuide, /Simulation Lab policy note:/);
});
