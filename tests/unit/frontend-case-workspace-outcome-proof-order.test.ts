import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace outcome line follows the immediate proof path", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  assert.ok(
    appSource.includes("opens its protected review, and then hands the case to"),
    "case-step outcome copy should mention protected review before the next stage handoff",
  );
  assert.ok(
    appSource.includes("opens its final protected review."),
    "final case-step outcome copy should mention the final protected review",
  );
  assert.ok(
    readmeSource.includes("Outcome / Next proof` line now follows the immediate proof path"),
    "README should explain that the outcome/proof line now follows the immediate proof path",
  );
  assert.ok(
    operatorGuideSource.includes("Outcome / Next proof` line now follows the immediate proof path"),
    "operator guide should explain that the outcome/proof line now follows the immediate proof path",
  );
});
