import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("live request becomes a drawer that stays open on idle and collapses during case work", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="caseWorkspaceRequestShell"',
    'class="case-workspace-action-section case-workspace-action-section-request case-workspace-action-shell"',
    'id="caseWorkspaceRequestTitle"',
    'id="caseWorkspaceRequestChip"',
    'id="sendBtn"',
    'id="sendBtnHint"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing request drawer token: ${token}`);
  }

  assert.ok(htmlSource.includes('id="caseWorkspaceRequestShell"') && htmlSource.includes("open"), "request drawer should stay open by default in static idle html");

  for (const token of [
    "function getCaseWorkspaceRequestDrawerContent(flowState, isRu)",
    'title: isRu ? "Live-запрос в работе" : "Live request in progress"',
    "return to the case workspace.",
    'title: isRu ? "Отдельный live-запрос после кейса" : "Standalone live request"',
    'chip: isRu ? "После кейса" : "After case"',
    'title: isRu ? "Отдельный запрос вне кейса" : "Live request outside the case"',
    'chip: isRu ? "Отдельно" : "Side path"',
    'open: false,',
    'signatureKey: "active:" + activeActionId',
    'signatureKey: "complete"',
    'const requestDrawer = document.getElementById("caseWorkspaceRequestShell")',
    'syncCaseWorkspaceSubshellOpen(',
    '"drawer:request:" + requestDrawerCopy.signatureKey',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing request drawer runtime token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("the standalone `Live request` lane now lives in its own drawer"),
    "README should describe the live-request drawer behavior",
  );
  assert.ok(
    operatorGuideSource.includes("the standalone `Live request` lane now sits in its own drawer"),
    "operator guide should describe the live-request drawer behavior",
  );
});
