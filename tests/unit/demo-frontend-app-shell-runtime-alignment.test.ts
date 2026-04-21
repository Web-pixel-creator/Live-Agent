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
});

test("live desk and console surfaces prefer repo-owned runtime data with draft fallback support", () => {
  const liveDesk = readAppShellSource("components/workspace/LiveDesk.tsx");
  const consoleStage = readAppShellSource("components/workspace/ConsoleStage.tsx");
  const consolePage = readAppShellSource("pages/Console.tsx");

  assert.match(liveDesk, /const \{ cases, deviceNodes, addDraftCase \} = useWorkspaceRuntime\(\);/);
  assert.match(liveDesk, /existingCases=\{cases\}/);
  assert.match(liveDesk, /addDraftCase\(draft\);/);
  assert.match(liveDesk, /deviceNodes\.find\(\(n\) => n\.id === nodeFilterId\)/);

  assert.match(consoleStage, /const \{ deviceNodes, getCaseByRef \} = useWorkspaceRuntime\(\);/);
  assert.match(consoleStage, /const baseCase = getCaseByRef\(caseRef\);/);
  assert.match(consoleStage, /deviceNodes\.find\(\(n\) => n\.id === c\.sourceNodeId\)/);

  assert.match(consolePage, /const \{ defaultConsoleCaseRef \} = useWorkspaceRuntime\(\);/);
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

  assert.match(palette, /const \{ cases, pendingApprovals \} = useWorkspaceRuntime\(\);/);
  assert.match(palette, /run\(\(\) => navigate\("\/app\/nodes"\)\)/);

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
