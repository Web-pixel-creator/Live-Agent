import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("demo frontend preserves integer and zero deltas in KPI badges", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const appSource = readFileSync(appPath, "utf8");

  const startToken = "function formatCompactNumber(value) {";
  const endToken = "\n\nfunction setKpiConstraintSourceLabel(text) {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing formatCompactNumber helper");
  assert.notEqual(endIndex, -1, "frontend runtime missing KPI delta helper boundary");

  class FakeHTMLElement {
    textContent = "";
    className = "";
    classList = {
      values: new Set<string>(),
      add: (...tokens: string[]) => {
        for (const token of tokens) {
          this.classList.values.add(token);
        }
      },
    };
  }

  const helperSource = appSource.slice(startIndex, endIndex);
  const helpers = runInNewContext(
    `${helperSource}; ({ formatCompactNumber, setKpiDeltaBadge, setKpiConstraintDelta })`,
    {
      HTMLElement: FakeHTMLElement,
    },
  ) as {
    formatCompactNumber: (value: number) => string;
    setKpiConstraintDelta: (
      node: InstanceType<typeof FakeHTMLElement>,
      value: number | null,
      target: number | null,
      comparator: "max" | "min",
      unitSuffix?: string,
    ) => void;
  };

  assert.equal(helpers.formatCompactNumber(-10), "-10");
  assert.equal(helpers.formatCompactNumber(0), "0");
  assert.equal(helpers.formatCompactNumber(1.5), "1.5");

  const priceNode = new FakeHTMLElement();
  helpers.setKpiConstraintDelta(priceNode, 90, 100, "max");
  assert.equal(priceNode.textContent, "delta -10");

  const slaNode = new FakeHTMLElement();
  helpers.setKpiConstraintDelta(slaNode, 98, 98, "min", "pp");
  assert.equal(slaNode.textContent, "delta +0pp");
});
