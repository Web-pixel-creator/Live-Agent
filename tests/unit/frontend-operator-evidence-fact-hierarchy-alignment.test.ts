import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator focused evidence promotes one lead fact above quieter supporting facts", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const runtimeTokens = [
    'facts.forEach((fact, index) => {',
    'article.classList.add(index === 0 ? "is-primary" : "is-secondary");',
    'article.classList.add(`is-${index === 0 ? model.variant ?? "muted" : "muted"}`);',
  ];
  for (const token of runtimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing focused evidence hierarchy token: ${token}`);
  }

  const styleTokens = [
    '.panel-operator-console .operator-evidence-drawer-fact.is-primary {',
    'grid-column: span 2;',
    '.panel-operator-console .operator-evidence-drawer-fact.is-secondary {',
    '.panel-operator-console .operator-evidence-drawer-fact.is-primary strong {',
  ];
  for (const token of styleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing focused evidence hierarchy token: ${token}`);
  }

  assert.ok(
    readmeSource.includes('lead evidence card while the other two stay quieter supporting context'),
    'README missing lead evidence fact hierarchy note',
  );
  assert.ok(
    operatorGuideSource.includes('lead evidence card while the other two stay quieter supporting context'),
    'operator guide missing lead evidence fact hierarchy note',
  );
});
