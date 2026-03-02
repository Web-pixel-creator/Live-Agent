import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator plugin marketplace lifecycle widget is wired in frontend HTML and runtime", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredHtmlIds = [
    'id="operatorPluginMarketplaceStatus"',
    'id="operatorPluginMarketplaceTotal"',
    'id="operatorPluginMarketplacePlugins"',
    'id="operatorPluginMarketplaceOutcomes"',
    'id="operatorPluginMarketplaceSigning"',
    'id="operatorPluginMarketplacePermissions"',
    'id="operatorPluginMarketplaceLifecycle"',
    'id="operatorPluginMarketplaceConflicts"',
    'id="operatorPluginMarketplaceLatest"',
    'id="operatorPluginMarketplaceSeenAt"',
    'id="operatorPluginMarketplaceHint"',
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(htmlSource.includes(token), `frontend html missing operator plugin-marketplace widget token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "setOperatorPluginMarketplaceHint",
    "resetOperatorPluginMarketplaceWidget",
    "renderOperatorPluginMarketplaceWidget",
    "summary.pluginMarketplaceLifecycle",
    "plugin_marketplace.lifecycle",
    "plugin_marketplace.latest",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing operator plugin-marketplace token: ${token}`);
  }
});
