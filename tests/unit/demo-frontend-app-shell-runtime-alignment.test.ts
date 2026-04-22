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
  const runtimeDiagnosticsPanels = readAppShellSource("components/workspace/RuntimeDiagnosticsPanels.tsx");
  const sessionBoundaryPanel = readAppShellSource("components/workspace/SessionBoundaryPanel.tsx");
  const sessionOpsPanel = readAppShellSource("components/workspace/SessionOpsPanel.tsx");
  const artifactViewerPanel = readAppShellSource("components/workspace/ArtifactViewerPanel.tsx");
  const artifactViewerLib = readAppShellSource("lib/runtime-artifact-viewer.ts");
  const replayRuntime = readAppShellSource("lib/runtime-session-replay.ts");
  const consolePage = readAppShellSource("pages/Console.tsx");

  assert.match(liveDesk, /const \{ cases, deviceNodes, addDraftCase \} = useWorkspaceRuntime\(\);/);
  assert.match(liveDesk, /existingCases=\{cases\}/);
  assert.match(liveDesk, /addDraftCase\(draft\);/);
  assert.match(liveDesk, /deviceNodes\.find\(\(n\) => n\.id === nodeFilterId\)/);

  assert.match(consoleStage, /const \{ deviceNodes, getCaseByRef \} = useWorkspaceRuntime\(\);/);
  assert.match(consoleStage, /const baseCase = getCaseByRef\(caseRef\);/);
  assert.match(consoleStage, /deviceNodes\.find\(\(n\) => n\.id === c\.sourceNodeId\)/);
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
  assert.match(consoleRuntime, /<SessionOpsPanel caseValue=\{runtimeCase\} wiki=\{wiki\} \/>/);
  assert.match(consoleRuntime, /<RuntimeDiagnosticsPanels caseValue=\{runtimeCase\} \/>/);
  assert.match(consoleRuntime, /<ArtifactViewerPanel \/>/);
  assert.match(consoleRuntime, /navigate\(`\/app\/console\$\{search \? `\?\$\{search\}` : ""\}\$\{hash\}`/);
  assert.match(caseWikiPanel, /Copy handoff/);
  assert.match(caseWikiPanel, /Copy refs/);
  assert.match(caseWikiPanel, /Open bundle/);
  assert.match(caseWikiPanel, /Open evidence/);
  assert.match(caseWikiPanel, /exportReady === false/);
  assert.match(caseWikiPanel, /operatorPreviewPack\?\.remediation\?\.draft/);
  assert.match(caseWikiPanel, /compliance\?\.enforcement\?\.summary/);
  assert.match(caseWikiPanel, /evidenceSignature\?\.status/);
  assert.match(sessionBoundaryPanel, /Session Boundary/);
  assert.match(sessionBoundaryPanel, /id="connections"/);
  assert.match(sessionBoundaryPanel, /fetchRuntimeSessionReplay/);
  assert.match(sessionBoundaryPanel, /buildRuntimeSessionReplaySummary/);
  assert.match(sessionBoundaryPanel, /Proof ingress:/);
  assert.match(sessionBoundaryPanel, /Turn ingress:/);
  assert.match(sessionBoundaryPanel, /After refresh/);
  assert.match(sessionOpsPanel, /Operator Session Ops/);
  assert.match(sessionOpsPanel, /Export Markdown/);
  assert.match(sessionOpsPanel, /Export JSON/);
  assert.match(sessionOpsPanel, /Refresh replay/);
  assert.match(sessionOpsPanel, /Refresh Case Wiki/);
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
  assert.match(runtimeDiagnosticsPanels, /Refresh workflow/);
  assert.match(runtimeDiagnosticsPanels, /Clear override/);
  assert.match(runtimeDiagnosticsPanels, /Refresh guardrails/);
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
  assert.match(artifactViewerLib, /export async function fetchRuntimeArtifactIndex/);
  assert.match(artifactViewerLib, /export async function fetchRuntimeArtifactDocument/);
  assert.match(artifactViewerLib, /export function summarizeRuntimeArtifact/);

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

  assert.match(liveDesk, /import \{\s*buildCaseBundlePath,\s*buildCaseEvidencePath,\s*\} from "@\/lib\/case-artifact-links";/);
  assert.match(liveDesk, /navigate\(buildCaseBundlePath\(value\)\);/);
  assert.match(liveDesk, /navigate\(buildCaseEvidencePath\(value\)\);/);

  assert.match(consoleStage, /import \{\s*buildCaseBundlePath,\s*buildCaseEvidencePath,\s*\} from "@\/lib\/case-artifact-links";/);
  assert.match(consoleStage, /navigate\(buildCaseBundlePath\(c\)\);/);
  assert.match(consoleStage, /navigate\(buildCaseEvidencePath\(c\)\);/);

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
