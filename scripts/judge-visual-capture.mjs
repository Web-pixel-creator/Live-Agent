import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const options = {
    baseUrl: "http://localhost:3000",
    outputDir: "artifacts/judge-visual-evidence/screenshots",
    viewportWidth: 1920,
    viewportHeight: 1080,
    waitMs: 900,
    headless: true,
    mockObservability: true,
    mockAll: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--baseUrl") {
      options.baseUrl = String(argv[++index] ?? options.baseUrl);
      continue;
    }
    if (arg === "--outputDir") {
      options.outputDir = String(argv[++index] ?? options.outputDir);
      continue;
    }
    if (arg === "--viewportWidth") {
      options.viewportWidth = Math.max(720, Number(argv[++index] ?? options.viewportWidth));
      continue;
    }
    if (arg === "--viewportHeight") {
      options.viewportHeight = Math.max(480, Number(argv[++index] ?? options.viewportHeight));
      continue;
    }
    if (arg === "--waitMs") {
      options.waitMs = Math.max(0, Number(argv[++index] ?? options.waitMs));
      continue;
    }
    if (arg === "--headed") {
      options.headless = false;
      continue;
    }
    if (arg === "--noMockObservability") {
      options.mockObservability = false;
      continue;
    }
    if (arg === "--mockAll") {
      options.mockAll = true;
      options.mockObservability = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function toAbsolutePath(pathLike) {
  if (isAbsolute(pathLike)) {
    return pathLike;
  }
  return resolve(process.cwd(), pathLike);
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function observabilityMockHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Observability Evidence</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        background: #04161e;
        color: #d8f6f2;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      main {
        width: 100%;
        min-height: 100vh;
        padding: 28px;
        box-sizing: border-box;
      }
      h1 {
        margin: 0 0 16px;
        font-size: 28px;
      }
      .board {
        border: 1px solid #2a4e56;
        border-radius: 14px;
        background: #06212b;
        padding: 18px;
      }
      .kpi-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 14px;
      }
      .kpi {
        border: 1px solid #2a4e56;
        border-radius: 10px;
        background: #081b22;
        padding: 10px;
      }
      .kpi .label {
        font-size: 12px;
        color: #92bdc0;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .kpi .value {
        margin-top: 8px;
        font-size: 24px;
        font-weight: 700;
      }
      .alert-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .alert-card {
        border: 1px solid #2a4e56;
        border-radius: 12px;
        background: #081b22;
        padding: 12px;
      }
      .alert-card h2 {
        margin: 0 0 8px;
        font-size: 16px;
      }
      .pill {
        display: inline-block;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
      }
      .ok { background: rgba(0, 200, 83, 0.2); color: #baffd8; }
      .warn { background: rgba(255, 159, 67, 0.2); color: #ffd8b2; }
      .meta { margin-top: 10px; font-size: 12px; color: #92bdc0; }
    </style>
  </head>
  <body>
    <main>
      <h1>MLA Observability Dashboard</h1>
      <section id="observability-dashboard" class="board">
        <div class="kpi-row">
          <article class="kpi">
            <div class="label">Gateway P95</div>
            <div class="value">286 ms</div>
          </article>
          <article class="kpi">
            <div class="label">Error Rate</div>
            <div class="value">0.2%</div>
          </article>
          <article class="kpi">
            <div class="label">Orchestrator Writes</div>
            <div class="value">99.9%</div>
          </article>
          <article class="kpi">
            <div class="label">Policy Checks</div>
            <div class="value">193/193</div>
          </article>
        </div>
        <div class="alert-grid">
          <article id="observability-alert-gateway-latency" class="alert-card">
            <h2>MLA Gateway P95 Latency High</h2>
            <span class="pill warn">Enabled</span>
            <p class="meta">Condition: gateway.p95_ms > 300 for 5m</p>
          </article>
          <article id="observability-alert-service-error-rate" class="alert-card">
            <h2>MLA Service Error Rate High</h2>
            <span class="pill warn">Enabled</span>
            <p class="meta">Condition: service.error_rate_pct > 1 for 5m</p>
          </article>
          <article id="observability-alert-orchestrator-persistence" class="alert-card">
            <h2>MLA Orchestrator Persistence Failures</h2>
            <span class="pill ok">Enabled</span>
            <p class="meta">Condition: persistence.failures > 0 for 1m</p>
          </article>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function fullMockHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Judge Visual Mock</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        background: #04161e;
        color: #d8f6f2;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      main {
        padding: 24px;
        display: grid;
        gap: 16px;
      }
      section {
        border: 1px solid #2a4e56;
        border-radius: 12px;
        background: #06212b;
        padding: 14px;
      }
      h2 { margin: 0 0 10px; }
      .row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .item {
        border: 1px solid #2a4e56;
        border-radius: 8px;
        background: #081b22;
        padding: 8px;
      }
      .pill {
        display: inline-block;
        border-radius: 999px;
        padding: 4px 8px;
        background: rgba(255, 159, 67, 0.25);
      }
      .ok { background: rgba(0, 200, 83, 0.2); }
    </style>
  </head>
  <body>
    <main>
      <section id="live-console-main">
        <h2>Live Console</h2>
        <div class="row">
          <div class="item">Connection: connected</div>
          <div class="item">Assistant: streaming</div>
          <div class="item">PTT: enabled</div>
        </div>
      </section>
      <section id="operator-console-evidence">
        <h2>Operator Console</h2>
        <div class="row">
          <div class="item">Turn Truncation: pass</div>
          <div class="item">Turn Delete: pass</div>
          <div class="item">Damage Control: pass</div>
        </div>
      </section>
      <section id="storyteller-timeline">
        <h2>Story Timeline</h2>
        <div class="row">
          <div class="item">Segment #1</div>
          <div class="item">Segment #2</div>
          <div class="item">Segment #3</div>
        </div>
      </section>
      <section id="approval-flow-pending">
        <h2>Approval Flow</h2>
        <span class="pill">pending</span>
      </section>
      <section id="approval-flow-approved">
        <h2>Approval Flow</h2>
        <span class="pill ok">approved</span>
      </section>
      <section id="observability-dashboard">
        <h2>Observability Dashboard</h2>
        <div class="row">
          <div class="item">Gateway P95: 286 ms</div>
          <div class="item">Error Rate: 0.2%</div>
          <div class="item">Policy: 193/193</div>
        </div>
      </section>
      <section id="observability-alert-gateway-latency">
        <h2>MLA Gateway P95 Latency High</h2>
      </section>
      <section id="observability-alert-service-error-rate">
        <h2>MLA Service Error Rate High</h2>
      </section>
      <section id="observability-alert-orchestrator-persistence">
        <h2>MLA Orchestrator Persistence Failures</h2>
      </section>
    </main>
  </body>
</html>`;
}

async function screenshotElement(page, selector, outputPath, waitMs = 0) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 20000 });
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  await locator.screenshot({ path: outputPath });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputDir = toAbsolutePath(options.outputDir);
  const baseUrl = options.baseUrl;
  mkdirSync(outputDir, { recursive: true });

  const output = {
    liveConsoleMain: resolve(outputDir, "live-console-main.png"),
    operatorConsoleEvidence: resolve(outputDir, "operator-console-evidence.png"),
    storytellerTimeline: resolve(outputDir, "storyteller-timeline.png"),
    approvalPending: resolve(outputDir, "approval-flow-pending.png"),
    approvalApproved: resolve(outputDir, "approval-flow-approved.png"),
    observabilityDashboard: resolve(outputDir, "observability-dashboard.png"),
    alertGatewayLatency: resolve(outputDir, "observability-alert-gateway-latency.png"),
    alertServiceErrorRate: resolve(outputDir, "observability-alert-service-error-rate.png"),
    alertOrchestratorPersistence: resolve(outputDir, "observability-alert-orchestrator-persistence.png"),
  };

  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    viewport: {
      width: Math.floor(options.viewportWidth),
      height: Math.floor(options.viewportHeight),
    },
  });
  const page = await context.newPage();

  try {
    if (options.mockAll) {
      await page.setContent(fullMockHtml(), { waitUntil: "domcontentloaded" });
      await screenshotElement(page, "#live-console-main", output.liveConsoleMain, 80);
      await screenshotElement(page, "#operator-console-evidence", output.operatorConsoleEvidence, 80);
      await screenshotElement(page, "#storyteller-timeline", output.storytellerTimeline, 80);
      await screenshotElement(page, "#approval-flow-pending", output.approvalPending, 80);
      await screenshotElement(page, "#approval-flow-approved", output.approvalApproved, 80);
      await screenshotElement(page, "#observability-dashboard", output.observabilityDashboard, 80);
      await screenshotElement(page, "#observability-alert-gateway-latency", output.alertGatewayLatency, 80);
      await screenshotElement(page, "#observability-alert-service-error-rate", output.alertServiceErrorRate, 80);
      await screenshotElement(
        page,
        "#observability-alert-orchestrator-persistence",
        output.alertOrchestratorPersistence,
        80,
      );
    } else {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 20000 });
      if (options.waitMs > 0) {
        await sleep(options.waitMs);
      }

      await page.screenshot({ path: output.liveConsoleMain });
      await screenshotElement(
        page,
        "section.panel:has(h2:text-is('Operator Console'))",
        output.operatorConsoleEvidence,
        200,
      );
      await screenshotElement(page, "section.panel:has(h2:text-is('Story Timeline'))", output.storytellerTimeline, 120);

      await page.evaluate(() => {
        const status = document.getElementById("approvalStatus");
        const approvalId = document.getElementById("approvalId");
        if (status) {
          status.textContent = "pending";
        }
        if (approvalId && "value" in approvalId) {
          approvalId.value = "approval-judge-pending";
        }
      });
      await screenshotElement(page, "section.panel:has(h2:text-is('Approval Control'))", output.approvalPending, 120);

      await page.evaluate(() => {
        const status = document.getElementById("approvalStatus");
        const approvalId = document.getElementById("approvalId");
        if (status) {
          status.textContent = "approved";
        }
        if (approvalId && "value" in approvalId) {
          approvalId.value = "approval-judge-approved";
        }
      });
      await screenshotElement(page, "section.panel:has(h2:text-is('Approval Control'))", output.approvalApproved, 120);

      if (options.mockObservability) {
        await page.setContent(observabilityMockHtml(), { waitUntil: "domcontentloaded" });
        await screenshotElement(page, "#observability-dashboard", output.observabilityDashboard, 100);
        await screenshotElement(page, "#observability-alert-gateway-latency", output.alertGatewayLatency, 80);
        await screenshotElement(page, "#observability-alert-service-error-rate", output.alertServiceErrorRate, 80);
        await screenshotElement(
          page,
          "#observability-alert-orchestrator-persistence",
          output.alertOrchestratorPersistence,
          80,
        );
      }
    }

    const manifestPath = resolve(outputDir, "_capture-manifest.json");
    const captureManifest = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      baseUrl,
      headless: options.headless,
      mockObservability: options.mockObservability,
      mockAll: options.mockAll,
      output,
    };
    writeFileSync(manifestPath, `${JSON.stringify(captureManifest, null, 2)}\n`, { encoding: "utf8" });

    console.log(`[judge-visual-capture] Base URL: ${baseUrl}`);
    console.log(`[judge-visual-capture] Output directory: ${outputDir}`);
    console.log(`[judge-visual-capture] Capture manifest: ${manifestPath}`);
    console.log("[judge-visual-capture] Status: pass");
  } catch (error) {
    const message = String(error?.message ?? error);
    if (message.includes("Executable doesn't exist") || message.includes("browserType.launch")) {
      console.error("[judge-visual-capture] Playwright browser is missing. Run: npx playwright install chromium");
    }
    console.error(`[judge-visual-capture] Failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
