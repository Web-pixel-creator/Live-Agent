import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence collapses dormant proof rails into one Proof path disclosure", () => {
  const htmlSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'id="operatorEvidenceDrawerProofPathSection"',
    'class="operator-evidence-drawer-proof-path"',
    'class="operator-evidence-drawer-proof-path-summary"',
    'class="operator-evidence-drawer-proof-path-kicker">Proof path<',
    'class="operator-evidence-drawer-proof-path-title">Timeline, checkpoints, and provenance<',
    'class="operator-evidence-drawer-proof-path-hint">Open when you need the full trace chain.<',
    'class="operator-evidence-drawer-timeline-shell"',
    'class="operator-evidence-drawer-checkpoints-shell"',
    'class="operator-evidence-drawer-provenance-shell"',
  ]) {
    assert.ok(htmlSource.includes(token), `index.html should keep the proof path disclosure shell: ${token}`);
  }

  assert.match(
    appSource,
    /showTimeline:\s*false,\s*showCheckpoints:\s*false,\s*showProvenance:\s*true,\s*showMeta:\s*false,\s*showLabel:\s*false,\s*showOrigins:\s*false,/s,
    "app.js should keep dormant proof rails collapsed under the proof path disclosure",
  );

  assert.ok(
    readmeSource.includes("collapses its timeline, checkpoints, and provenance behind one `Proof path` disclosure"),
    "README should document the dormant proof path disclosure",
  );
  assert.ok(
    operatorGuideSource.includes("collapses its timeline, checkpoints, and provenance behind one `Proof path` disclosure"),
    "operator guide should document the dormant proof path disclosure",
  );
});

test("focused evidence keeps hydrated proof rails available in the existing trace path", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");

  assert.match(
    appSource,
    /showTimeline:\s*true,\s*showCheckpoints:\s*true,\s*showProvenance:\s*true,\s*showMeta:\s*false,\s*showOrigins:\s*true,/s,
    "hydrated focused evidence should keep the trace proof rails visible",
  );

  for (const token of [
    "function buildOperatorEvidenceDrawerTraceTimeline(details) {",
    "function buildOperatorEvidenceDrawerRecoveryTimeline(details) {",
    "function buildOperatorEvidenceDrawerAuditTimeline(details) {",
    "timelineShell.hidden = activeView?.showTimeline === false;",
    "checkpointsShell.hidden = activeView?.showCheckpoints === false;",
    "provenanceShell.hidden = activeView?.showProvenance === false;",
  ]) {
    assert.ok(appSource.includes(token), `app.js should preserve hydrated proof rail structure: ${token}`);
  }
});
