import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("product docs consistently use AI Action Desk and Simulation Lab source-of-truth framing", () => {
  const files = [
    {
      path: resolve(process.cwd(), "docs", "architecture.md"),
      tokens: [
        "AI Action Desk",
        "Simulation Lab",
        "docs/product-master-plan.md",
        "docs/product-backlog.md",
        "The three challenge categories are internal capability lanes, not separate",
      ],
    },
    {
      path: resolve(process.cwd(), "docs", "judge-runbook.md"),
      tokens: [
        "Source of Truth",
        "docs/product-master-plan.md",
        "docs/product-backlog.md",
        "AI Action Desk",
        "Simulation Lab",
      ],
    },
    {
      path: resolve(process.cwd(), "docs", "local-development.md"),
      tokens: [
        "Source of Truth",
        "docs/product-master-plan.md",
        "docs/product-backlog.md",
        "AI Action Desk",
        "Simulation Lab",
      ],
    },
    {
      path: resolve(process.cwd(), "docs", "product-master-plan.md"),
      tokens: [
        "Source of Truth",
        "AI Action Desk",
        "Simulation Lab",
        "The three challenge categories are implementation lanes under this product",
      ],
    },
    {
      path: resolve(process.cwd(), "docs", "product-backlog.md"),
      tokens: [
        "Source of Truth",
        "AI Action Desk",
        "execution queue",
        "challenge-mode framing",
      ],
    },
  ];

  for (const { path, tokens } of files) {
    const source = readFileSync(path, "utf8");
    for (const token of tokens) {
      assert.ok(source.includes(token), `${path} missing token: ${token}`);
    }
  }
});
