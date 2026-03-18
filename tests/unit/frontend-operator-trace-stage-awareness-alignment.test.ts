import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator trace widget exposes stage-aware bottleneck views", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");

  const requiredTokens = [
    "getOperatorTraceBottleneckViews",
    "formatOperatorTraceBottleneckRun",
    "bottlenecks",
    "trace.filter.awaiting_approval",
    "trace.filter.verification_failed",
    "trace.filter.browser_run_incomplete",
    "trace.filter.escalation_required",
    "covered_with_bottlenecks",
  ];

  for (const token of requiredTokens) {
    assert.ok(appSource.includes(token), `operator trace widget missing stage-awareness token: ${token}`);
  }
});
