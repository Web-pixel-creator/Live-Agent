import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("demo frontend maps structured negotiation output into current and final KPI offers", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const runbookSource = readFileSync(runbookPath, "utf8");

  const startToken = "function toNegotiationOfferMetricValue(value) {";
  const endToken = "\n\nfunction setKpiMetricVariant(node, variant = \"neutral\") {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing structured negotiation KPI helper");
  assert.notEqual(endIndex, -1, "frontend runtime missing structured negotiation KPI helper boundary");

  const helperSource = appSource.slice(startIndex, endIndex);
  const context = {
    el: {
      currentPrice: { textContent: "-" },
      currentDelivery: { textContent: "-" },
      currentSla: { textContent: "-" },
      finalPrice: { textContent: "-" },
      finalDelivery: { textContent: "-" },
      finalSla: { textContent: "-" },
    },
    setMaybeValue(node: { textContent: string }, value: number | null, suffix = "") {
      node.textContent = value === null || value === undefined ? "-" : `${value}${suffix}`;
    },
  };

  const helpers = runInNewContext(
    `${helperSource}; ({ toNegotiationOfferMetricValue, setNegotiationOfferMetrics, clearNegotiationOfferMetrics, applyNegotiationOutputToKpi })`,
    context,
  ) as {
    toNegotiationOfferMetricValue: (value: unknown) => number | null;
    clearNegotiationOfferMetrics: (fields: Record<string, { textContent: string }>) => void;
    applyNegotiationOutputToKpi: (negotiation: unknown) => boolean;
  };

  assert.equal(helpers.toNegotiationOfferMetricValue("100%"), 100);
  assert.equal(helpers.toNegotiationOfferMetricValue("14"), 14);
  assert.equal(helpers.toNegotiationOfferMetricValue(""), null);

  const applied = helpers.applyNegotiationOutputToKpi({
    sourceOffer: { price: 120, deliveryDays: 17, sla: 100 },
    proposedOffer: { price: 100, deliveryDays: 14, sla: 100 },
  });

  assert.equal(applied, true, "structured negotiation output should be accepted by the KPI mapper");
  assert.equal(context.el.currentPrice.textContent, "120");
  assert.equal(context.el.currentDelivery.textContent, "17");
  assert.equal(context.el.currentSla.textContent, "100%");
  assert.equal(context.el.finalPrice.textContent, "100");
  assert.equal(context.el.finalDelivery.textContent, "14");
  assert.equal(context.el.finalSla.textContent, "100%");

  helpers.clearNegotiationOfferMetrics({
    price: context.el.finalPrice,
    delivery: context.el.finalDelivery,
    sla: context.el.finalSla,
  });

  assert.equal(context.el.finalPrice.textContent, "-");
  assert.equal(context.el.finalDelivery.textContent, "-");
  assert.equal(context.el.finalSla.textContent, "-");

  assert.ok(
    readmeSource.includes("`Current Offer` tracks the client offer and `Final Offer` reflects the latest structured agent proposal"),
    "README should describe structured negotiation KPI mapping",
  );
  assert.ok(
    runbookSource.includes("`Final Offer` should reflect the latest agent counter-offer/proposed compliant terms."),
    "challenge demo runbook should describe current/final negotiation KPI behavior",
  );
});
