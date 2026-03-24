import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator handoff quick-path buttons reflect the current workspace without changing jump paths", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorConsoleEntryApprovalsBtn"',
    'id="operatorConsoleEntryRuntimeBtn"',
    'id="operatorConsoleEntryAuditBtn"',
    'id="operatorConsoleEntryRefreshBtn"',
    'class="operator-console-entry-actions"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html missing operator handoff quick-path token: ${token}`);
  }

  assert.match(appSource, /el\.operatorConsoleEntryApprovalsBtn\.textContent\s*=\s*"Approvals";/);
  assert.match(appSource, /el\.operatorConsoleEntryRuntimeBtn\.textContent\s*=\s*"Runtime";/);
  assert.match(appSource, /el\.operatorConsoleEntryAuditBtn\.textContent\s*=\s*"Audit";/);
  assert.match(
    appSource,
    /item\.button\.dataset\.entryActionState\s*=\s*isCurrentWorkspace\s*\?\s*"current"\s*:\s*"jump";/s,
  );
  assert.match(
    appSource,
    /item\.button\.textContent\s*=\s*isCurrentWorkspace\s*\?\s*`\$\{item\.label\} current`\s*:\s*item\.label;/s,
  );
  assert.match(
    appSource,
    /item\.button\.setAttribute\("aria-pressed",\s*isCurrentWorkspace\s*\?\s*"true"\s*:\s*"false"\);/s,
  );

  for (const token of [
    '.panel-operator-console .operator-console-entry-action[data-entry-action-state="current"] {',
    '.panel-operator-console .operator-console-entry-action[data-entry-action-state="current"]:hover {',
  ]) {
    assert.ok(stylesSource.includes(token), `styles.css missing operator handoff current-action token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("quick-path buttons inside `Operator handoff` now also reflect the current workspace"),
    "README should document workspace-aware handoff quick-path buttons",
  );
  assert.ok(
    operatorGuideSource.includes("quick-path buttons now also reflect the current workspace"),
    "operator guide should document workspace-aware handoff quick-path buttons",
  );
});
