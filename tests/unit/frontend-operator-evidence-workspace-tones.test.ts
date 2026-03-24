import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("focused evidence tunes fact and origin tones by active workspace posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    "function resolveOperatorEvidenceDrawerWorkspaceFactTone(fact, index, activeView, model) {",
    'if (workspaceId === "runtime") {',
    'if (activeView?.id === "trace") {',
    'if (workspaceId === "approvals") {',
    'if (workspaceId === "audit" && activeView?.id === "audit") {',
    'return "watch";',
    "function resolveOperatorEvidenceDrawerWorkspaceOriginTone(origin, activeView, model) {",
    'if (workspaceId === "incidents") {',
    'if (activeView?.id === "recovery" && normalizedLabel === "source") {',
    'if (activeView?.id === "latest" && normalizedLabel === "view") {',
    "const originTone = resolveOperatorEvidenceDrawerWorkspaceOriginTone(origin, activeView, model);",
    "const factTone = resolveOperatorEvidenceDrawerWorkspaceFactTone(fact, index, activeView, model);",
    "article.classList.add(`is-${factTone}`);",
  ]) {
    assert.ok(appSource.includes(token), `app.js missing workspace-tone token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("tunes `Focused Evidence` fact and origin tones by the active workspace posture"),
    "README should document workspace-aware focused evidence tones",
  );
  assert.ok(
    operatorGuideSource.includes("tunes `Focused Evidence` fact and origin tones by the active workspace posture"),
    "operator guide should document workspace-aware focused evidence tones",
  );
});
