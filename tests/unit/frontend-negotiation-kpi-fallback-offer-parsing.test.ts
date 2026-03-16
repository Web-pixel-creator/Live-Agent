import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("demo frontend recovers current and final KPI offers from fallback negotiation text and alias fields", () => {
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const readmePath = resolve(process.cwd(), "README.md");
  const runbookPath = resolve(process.cwd(), "docs", "challenge-demo-runbook.md");

  const appSource = readFileSync(appPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const runbookSource = readFileSync(runbookPath, "utf8");

  const startToken = "function extractNumber(text, regex) {";
  const endToken = "\n\nfunction setKpiMetricVariant(node, variant = \"neutral\") {";
  const startIndex = appSource.indexOf(startToken);
  const endIndex = appSource.indexOf(endToken, startIndex);

  assert.notEqual(startIndex, -1, "frontend runtime missing negotiation fallback helpers");
  assert.notEqual(endIndex, -1, "frontend runtime missing KPI helper boundary");

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
    `${helperSource}; ({ extractNegotiationOfferMetrics, updateOfferFromText, applyNegotiationOutputToKpi, clearNegotiationOfferMetrics })`,
    context,
  ) as {
    extractNegotiationOfferMetrics: (
      text: string,
      offerType?: "current" | "final",
    ) => { price: number | null; delivery: number | null; sla: number | null };
    updateOfferFromText: (text: string, isFinal?: boolean) => void;
    applyNegotiationOutputToKpi: (negotiation: unknown) => boolean;
    clearNegotiationOfferMetrics: (fields: Record<string, { textContent: string }>) => void;
  };

  const fallbackText =
    "Client offer: price 120, delivery 17 days, sla 100. Counter-offer: price 100, delivery 14 days, sla 99.";

  assert.deepEqual(JSON.parse(JSON.stringify(helpers.extractNegotiationOfferMetrics(fallbackText, "current"))), {
    price: 120,
    delivery: 17,
    sla: 100,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.extractNegotiationOfferMetrics(fallbackText, "final"))), {
    price: 100,
    delivery: 14,
    sla: 99,
  });

  helpers.updateOfferFromText(fallbackText, false);
  helpers.updateOfferFromText(fallbackText, true);

  assert.equal(context.el.currentPrice.textContent, "120");
  assert.equal(context.el.currentDelivery.textContent, "17");
  assert.equal(context.el.currentSla.textContent, "100%");
  assert.equal(context.el.finalPrice.textContent, "100");
  assert.equal(context.el.finalDelivery.textContent, "14");
  assert.equal(context.el.finalSla.textContent, "99%");

  helpers.clearNegotiationOfferMetrics({
    price: context.el.currentPrice,
    delivery: context.el.currentDelivery,
    sla: context.el.currentSla,
  });
  helpers.clearNegotiationOfferMetrics({
    price: context.el.finalPrice,
    delivery: context.el.finalDelivery,
    sla: context.el.finalSla,
  });

  const appliedAliasedPayload = helpers.applyNegotiationOutputToKpi({
    currentOffer: { price: "120", delivery: 17, sla: "100%" },
    finalOffer: { price: "100", deliveryDays: 14, slaPercent: 99 },
  });

  assert.equal(appliedAliasedPayload, true, "aliased negotiation payloads should still populate KPI cards");
  assert.equal(context.el.currentPrice.textContent, "120");
  assert.equal(context.el.currentDelivery.textContent, "17");
  assert.equal(context.el.currentSla.textContent, "100%");
  assert.equal(context.el.finalPrice.textContent, "100");
  assert.equal(context.el.finalDelivery.textContent, "14");
  assert.equal(context.el.finalSla.textContent, "99%");

  assert.ok(
    readmeSource.includes("falls back to labeled `Client offer` / `Counter-offer` text"),
    "README should document fallback negotiation KPI parsing",
  );
  assert.ok(
    runbookSource.includes("Fallback parsing from labeled `Client offer` / `Counter-offer` text"),
    "challenge runbook should document fallback negotiation KPI parsing",
  );
});
