import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator focused evidence latest summary avoids collapsing to bare counters", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredRuntimeTokens = [
    "const hasWeakLeadValue = Boolean(",
    "/^(0|none|none yet|awaiting|awaiting signal|0\\s*\\/\\s*0|\\d+|\\d+\\s*\\/\\s*\\d+)$/iu.test(leadValue)",
    "const actionFirstSnippet = formatOperatorEvidenceDrawerSummaryPart(",
    'details.primaryActionLabel ? `${details.primaryActionLabel} first` : clipOperatorEvidenceDrawerSentence(details.primaryActionMeta)',
    "} else if (details.factsMode === \"compact\" && hasWeakLeadValue) {",
    "parts = [actionFirstSnippet || hintSentence || secondarySnippet || leadSnippet];",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing evidence summary fallback token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("refuses to collapse `Latest` summary down to a bare counter like `0.`"),
    "README missing evidence bare-counter fallback note",
  );
  assert.ok(
    operatorGuideSource.includes("refuses to collapse `Latest` summary down to a bare counter like `0.`"),
    "operator guide missing evidence bare-counter fallback note",
  );
});
