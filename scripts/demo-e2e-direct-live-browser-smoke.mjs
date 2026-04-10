import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const options = {
    frontendBaseUrl: "http://localhost:3000",
    apiBaseUrl: "http://localhost:8081",
    sessionId: "",
    userId: "demo-e2e-user",
    output: "artifacts/demo-e2e/direct-live-browser-smoke.json",
    screenshot: "artifacts/demo-e2e/direct-live-browser-smoke.png",
    timeoutMs: 20000,
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--frontendBaseUrl") {
      options.frontendBaseUrl = String(argv[++index] ?? options.frontendBaseUrl);
      continue;
    }
    if (token === "--apiBaseUrl") {
      options.apiBaseUrl = String(argv[++index] ?? options.apiBaseUrl);
      continue;
    }
    if (token === "--sessionId") {
      options.sessionId = String(argv[++index] ?? options.sessionId);
      continue;
    }
    if (token === "--userId") {
      options.userId = String(argv[++index] ?? options.userId);
      continue;
    }
    if (token === "--output") {
      options.output = String(argv[++index] ?? options.output);
      continue;
    }
    if (token === "--screenshot") {
      options.screenshot = String(argv[++index] ?? options.screenshot);
      continue;
    }
    if (token === "--timeoutMs") {
      const parsed = Number(argv[++index] ?? options.timeoutMs);
      options.timeoutMs = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.timeoutMs;
      continue;
    }
    if (token === "--headed") {
      options.headed = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return null;
}

function toOptionalNonNegativeInt(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

async function ensureParentDir(pathLike) {
  await mkdir(dirname(resolve(process.cwd(), pathLike)), { recursive: true });
}

async function writeJson(pathLike, value) {
  const absolutePath = resolve(process.cwd(), pathLike);
  await ensureParentDir(absolutePath);
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return absolutePath;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let parsed = null;
  if (raw.trim().length > 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
    raw,
  };
}

function buildOperatorHeaders(includeJson = false) {
  const headers = {
    "x-operator-role": "operator",
  };
  if (includeJson) {
    headers["content-type"] = "application/json";
  }
  return headers;
}

function normalizeLiveRuntimeStatus(payload) {
  const data = isObject(payload?.data) ? payload.data : {};
  const capabilities = isObject(data.capabilities) ? data.capabilities : {};
  return {
    preferredMode: toOptionalString(data.preferredMode),
    activeMode: toOptionalString(data.activeMode),
    provider: toOptionalString(data.provider),
    model: toOptionalString(data.model),
    ephemeralTokensSupported: toBoolean(data.ephemeralTokensSupported) === true,
    fallbackAvailable: toBoolean(data.fallbackAvailable),
    lastFallbackReason: toOptionalString(data.lastFallbackReason),
    capabilities: {
      audioInput: toBoolean(capabilities.audioInput),
      audioOutput: toBoolean(capabilities.audioOutput),
      videoInput: toBoolean(capabilities.videoInput),
      screenInput: toBoolean(capabilities.screenInput),
      toolCalls: toBoolean(capabilities.toolCalls),
      interruptions: toBoolean(capabilities.interruptions),
      translation: toBoolean(capabilities.translation),
      reconnectSupported: toBoolean(capabilities.reconnectSupported),
    },
  };
}

function normalizeReplayLiveTransport(payload) {
  const selectedSession = isObject(payload?.data?.selectedSession) ? payload.data.selectedSession : {};
  const replay = isObject(selectedSession.replay) ? selectedSession.replay : {};
  const liveTransport = isObject(replay.liveTransport) ? replay.liveTransport : {};
  const activeMode = toOptionalString(liveTransport.activeMode);
  const provider = toOptionalString(liveTransport.provider);
  const model = toOptionalString(liveTransport.model);
  const bootstrapState = toOptionalString(liveTransport.bootstrapState);
  const fallbackReason = toOptionalString(liveTransport.fallbackReason);
  const evidenceSource = toOptionalString(liveTransport.evidenceSource);
  const capturedAt = toOptionalString(liveTransport.capturedAt);
  const firstAudioMs = toOptionalNonNegativeInt(liveTransport.firstAudioMs);
  const firstAudioCapturedAt = toOptionalString(liveTransport.firstAudioCapturedAt);
  const firstOutputMs = toOptionalNonNegativeInt(liveTransport.firstOutputMs);
  const firstOutputCapturedAt = toOptionalString(liveTransport.firstOutputCapturedAt);
  const fallbackEventCount = toOptionalNonNegativeInt(liveTransport.fallbackEventCount) ?? 0;
  if (
    !activeMode &&
    !provider &&
    !model &&
    !bootstrapState &&
    !fallbackReason &&
    !evidenceSource &&
    !capturedAt &&
    firstAudioMs === null &&
    firstOutputMs === null &&
    fallbackEventCount < 1
  ) {
    return null;
  }
  return {
    activeMode,
    provider,
    model,
    bootstrapState,
    fallbackReason,
    evidenceSource,
    capturedAt,
    firstAudioMs,
    firstAudioCapturedAt,
    firstOutputMs,
    firstOutputCapturedAt,
    fallbackEventCount,
  };
}

function normalizeCaseWikiSnapshot(payload) {
  const data = isObject(payload?.data) ? payload.data : {};
  const overview = isObject(data.overview) ? data.overview : {};
  const focusPack = isObject(data.focusPack) ? data.focusPack : {};
  const evidenceSignature = isObject(data.evidenceSignature) ? data.evidenceSignature : {};
  const caseId = toOptionalString(data.caseId);
  const sessionId = toOptionalString(data.sessionId);
  const overviewStatus = toOptionalString(overview.status);
  const focusKind = toOptionalString(focusPack.kind);
  const focusLabel = toOptionalString(focusPack.label);
  const recommendedNextAction = toOptionalString(data.recommendedNextAction);
  const sourceRefs = Array.isArray(focusPack.sourceRefs) ? focusPack.sourceRefs : [];
  const status = toOptionalString(evidenceSignature.status);
  const algorithm = toOptionalString(evidenceSignature.algorithm);
  const canonicalization = toOptionalString(evidenceSignature.canonicalization);
  const payloadHash = toOptionalString(evidenceSignature.payloadHash);
  const keyId = toOptionalString(evidenceSignature.keyId);
  const signerId = toOptionalString(evidenceSignature.signerId);
  const signedAt = toOptionalString(evidenceSignature.signedAt);
  const signaturePresent = toOptionalString(evidenceSignature.signature) !== null;

  if (
    !caseId &&
    !sessionId &&
    !overviewStatus &&
    !focusKind &&
    !focusLabel &&
    !recommendedNextAction &&
    !status &&
    !payloadHash &&
    !signerId
  ) {
    return null;
  }

  return {
    caseId,
    sessionId,
    overviewStatus,
    focusKind,
    focusLabel,
    recommendedNextAction,
    sourceRefsCount: sourceRefs.length,
    evidenceSignature: {
      status,
      algorithm,
      canonicalization,
      payloadHash,
      keyId,
      signerId,
      signedAt,
      signaturePresent,
    },
  };
}

async function readText(page, selector) {
  const locator = page.locator(selector);
  const count = await locator.count();
  if (count < 1) {
    return null;
  }
  const value = await locator.first().textContent();
  return toOptionalString(value);
}

async function ensureVoiceTrayConnectSurface(page, timeoutMs) {
  const voiceDockButton = page.locator("#liveDockVoiceBtn").first();
  if (await voiceDockButton.isVisible().catch(() => false)) {
    await voiceDockButton.click({ timeout: timeoutMs });
  }

  const connectButton = page.locator("#connectBtn").first();
  await connectButton.waitFor({ state: "visible", timeout: timeoutMs });
}

async function triggerFrontendButtonClick(page, selector, timeoutMs) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "attached", timeout: timeoutMs });

  try {
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ timeout: Math.min(timeoutMs, 5000) });
    return "playwright";
  } catch {
    await page.evaluate((targetSelector) => {
      const node = document.querySelector(targetSelector);
      if (!(node instanceof HTMLButtonElement)) {
        throw new Error(`button not found: ${targetSelector}`);
      }
      node.click();
    }, selector);
    return "dom";
  }
}

async function setFrontendInputValue(page, selector, value, timeoutMs) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "attached", timeout: timeoutMs });

  if (await locator.isVisible().catch(() => false)) {
    await locator.fill(value, { timeout: timeoutMs });
    return;
  }

  await page.evaluate(
    ({ targetSelector, targetValue }) => {
      const node = document.querySelector(targetSelector);
      if (!(node instanceof HTMLInputElement)) {
        throw new Error(`input not found: ${targetSelector}`);
      }
      node.value = targetValue;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { targetSelector: selector, targetValue: value },
  );
}

async function readFrontendInputValue(page, selector, timeoutMs) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "attached", timeout: timeoutMs });

  return page.evaluate((targetSelector) => {
    const node = document.querySelector(targetSelector);
    if (!(node instanceof HTMLInputElement)) {
      throw new Error(`input not found: ${targetSelector}`);
    }
    const normalized = node.value.trim();
    return normalized.length > 0 ? normalized : null;
  }, selector);
}

async function pollSessionReplay(apiBaseUrl, sessionId, timeoutMs) {
  const replayUrl = new URL(`${apiBaseUrl.replace(/\/+$/g, "")}/v1/runtime/session-replay`);
  replayUrl.searchParams.set("sessionId", sessionId);
  replayUrl.searchParams.set("sessionLimit", "20");
  replayUrl.searchParams.set("eventLimit", "120");
  replayUrl.searchParams.set("runLimit", "120");
  replayUrl.searchParams.set("approvalLimit", "120");
  replayUrl.searchParams.set("recentEventLimit", "200");

  const startedAt = Date.now();
  let latestPayload = null;
  while (Date.now() - startedAt < timeoutMs) {
    latestPayload = await fetchJson(replayUrl.toString(), {
      method: "GET",
      headers: buildOperatorHeaders(false),
    });
    const normalized = normalizeReplayLiveTransport(latestPayload.data);
    if (normalized?.activeMode === "direct_live" && normalized.evidenceSource === "session_events") {
      return {
        observed: true,
        payload: latestPayload.data,
        liveTransport: normalized,
      };
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 500));
  }

  return {
    observed: false,
    payload: latestPayload?.data ?? null,
    liveTransport: normalizeReplayLiveTransport(latestPayload?.data),
  };
}

async function pollCaseWiki(apiBaseUrl, sessionId, timeoutMs) {
  const caseWikiUrl = new URL(`${apiBaseUrl.replace(/\/+$/g, "")}/v1/runtime/case-wiki`);
  caseWikiUrl.searchParams.set("sessionId", sessionId);
  caseWikiUrl.searchParams.set("sessionLimit", "20");
  caseWikiUrl.searchParams.set("eventLimit", "120");
  caseWikiUrl.searchParams.set("runLimit", "120");
  caseWikiUrl.searchParams.set("approvalLimit", "120");
  caseWikiUrl.searchParams.set("recentEventLimit", "200");

  const startedAt = Date.now();
  let latestPayload = null;
  while (Date.now() - startedAt < timeoutMs) {
    latestPayload = await fetchJson(caseWikiUrl.toString(), {
      method: "GET",
      headers: buildOperatorHeaders(false),
    });
    const normalized = normalizeCaseWikiSnapshot(latestPayload.data);
    if (
      normalized?.sessionId === sessionId &&
      normalized.evidenceSignature?.algorithm === "ed25519-sha256" &&
      normalized.evidenceSignature?.canonicalization === "json-stable-v1" &&
      normalized.evidenceSignature?.payloadHash
    ) {
      return {
        observed: true,
        payload: latestPayload.data,
        caseWiki: normalized,
      };
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 500));
  }

  return {
    observed: false,
    payload: latestPayload?.data ?? null,
    caseWiki: normalizeCaseWikiSnapshot(latestPayload?.data),
  };
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (!toOptionalString(options.sessionId)) {
    throw new Error("--sessionId is required");
  }

  const generatedAt = new Date().toISOString();
  const capabilitiesResponse = await fetchJson(`${options.apiBaseUrl.replace(/\/+$/g, "")}/v1/runtime/live/capabilities`, {
    method: "GET",
    headers: buildOperatorHeaders(false),
  });
  if (!capabilitiesResponse.ok) {
    throw new Error(`live capabilities request failed with ${capabilitiesResponse.status}`);
  }

  const runtimeStatus = normalizeLiveRuntimeStatus(capabilitiesResponse.data);
  if (!runtimeStatus.ephemeralTokensSupported) {
    const skippedResult = {
      generatedAt,
      status: "skipped",
      reason: runtimeStatus.lastFallbackReason ?? "direct live is not supported in this runtime",
      frontendBaseUrl: options.frontendBaseUrl,
      apiBaseUrl: options.apiBaseUrl,
      sessionId: options.sessionId,
      userId: options.userId,
      runtimeStatus,
      ui: null,
      replay: {
        selectedSessionId: options.sessionId,
        liveTransport: null,
      },
      caseWiki: null,
      screenshotPath: null,
      summary: `direct live skipped: ${runtimeStatus.lastFallbackReason ?? "unsupported"}`,
    };
    const outputPath = await writeJson(options.output, skippedResult);
    process.stdout.write(`${JSON.stringify({ ...skippedResult, outputPath })}\n`);
    return;
  }

  const browser = await chromium.launch({ headless: !options.headed });
  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1080,
    },
  });
  const page = await context.newPage();
  const screenshotPath = resolve(process.cwd(), options.screenshot);

  try {
    const forcedUrl = new URL(options.frontendBaseUrl);
    forcedUrl.searchParams.set("livePreferredMode", "direct_live");

    await page.goto(forcedUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs,
    });
    await ensureVoiceTrayConnectSurface(page, options.timeoutMs);
    await setFrontendInputValue(page, "#sessionId", options.sessionId, options.timeoutMs);
    await setFrontendInputValue(page, "#userId", options.userId, options.timeoutMs);
    const connectClickPath = await triggerFrontendButtonClick(page, "#connectBtn", options.timeoutMs);

    await page.waitForFunction(
      () => {
        const connection = document.querySelector("#connectionStatus")?.textContent?.trim().toLowerCase() ?? "";
        const mode = document.querySelector("#modeStatus")?.textContent?.trim().toLowerCase() ?? "";
        return (
          connection === "connected" ||
          connection === "error" ||
          mode.includes("fallback") ||
          mode.includes("bootstrap_error")
        );
      },
      { timeout: options.timeoutMs },
    );

    await page.screenshot({ path: screenshotPath, fullPage: true });

    const ui = {
      connectionStatus: await readText(page, "#connectionStatus"),
      modeStatus: await readText(page, "#modeStatus"),
      sessionState: await readText(page, "#sessionState"),
      runId: await readText(page, "#runId"),
      actualSessionId: await readFrontendInputValue(page, "#sessionId", options.timeoutMs),
      actualUserId: await readFrontendInputValue(page, "#userId", options.timeoutMs),
      connectClickPath,
    };

    const replaySessionId = toOptionalString(ui.actualSessionId) ?? options.sessionId;
    const replayResult = await pollSessionReplay(
      options.apiBaseUrl,
      replaySessionId,
      Math.max(3000, Math.floor(options.timeoutMs / 2)),
    );
    const caseWikiResult = await pollCaseWiki(
      options.apiBaseUrl,
      replaySessionId,
      Math.max(3000, Math.floor(options.timeoutMs / 2)),
    );
    const liveTransport = replayResult.liveTransport;
    const caseWiki = caseWikiResult.caseWiki;
    const observedDirectLive = liveTransport?.activeMode === "direct_live" && liveTransport?.evidenceSource === "session_events";

    const status = observedDirectLive ? "pass" : "fail";
    const reason = observedDirectLive
      ? null
      : ui.modeStatus?.includes("fallback")
        ? "frontend fell back to relay while direct live was supported"
        : ui.connectionStatus === "error"
          ? "frontend connection ended in error before direct live replay proof was captured"
          : "backend replay never observed repo-owned direct_live session_events proof";

    try {
      if (ui.connectionStatus === "connected") {
        await triggerFrontendButtonClick(page, "#disconnectBtn", 5000);
      }
    } catch {
      // best-effort disconnect
    }

    const result = {
      generatedAt,
      status,
      reason,
      frontendBaseUrl: options.frontendBaseUrl,
      apiBaseUrl: options.apiBaseUrl,
      requestedSessionId: options.sessionId,
      sessionId: replaySessionId,
      userId: options.userId,
      runtimeStatus,
      ui,
      replay: {
        selectedSessionId: replaySessionId,
        liveTransport,
      },
      caseWiki: caseWiki
        ? {
            selectedSessionId: replaySessionId,
            observed: caseWikiResult.observed,
            caseId: caseWiki.caseId,
            sessionId: caseWiki.sessionId,
            overviewStatus: caseWiki.overviewStatus,
            focusKind: caseWiki.focusKind,
            focusLabel: caseWiki.focusLabel,
            recommendedNextAction: caseWiki.recommendedNextAction,
            sourceRefsCount: caseWiki.sourceRefsCount,
            evidenceSignature: caseWiki.evidenceSignature,
          }
        : {
            selectedSessionId: replaySessionId,
            observed: false,
            caseId: null,
            sessionId: null,
            overviewStatus: null,
            focusKind: null,
            focusLabel: null,
            recommendedNextAction: null,
            sourceRefsCount: 0,
            evidenceSignature: null,
          },
      screenshotPath,
      summary: observedDirectLive
        ? `direct_live observed via ${liveTransport?.evidenceSource ?? "unknown"} first_audio=${liveTransport?.firstAudioMs ?? "n/a"}ms first_output=${liveTransport?.firstOutputMs ?? "n/a"}ms fallback_events=${liveTransport?.fallbackEventCount ?? 0}`
        : `direct_live not observed; connection=${ui.connectionStatus ?? "unknown"} mode=${ui.modeStatus ?? "unknown"}`,
    };
    const outputPath = await writeJson(options.output, result);
    process.stdout.write(`${JSON.stringify({ ...result, outputPath })}\n`);
    if (!observedDirectLive) {
      process.exitCode = 1;
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch(async (error) => {
  const fallback = {
    generatedAt: new Date().toISOString(),
    status: "fail",
    reason: error instanceof Error ? error.message : String(error),
    frontendBaseUrl: null,
    apiBaseUrl: null,
    sessionId: null,
    userId: null,
    runtimeStatus: null,
    ui: null,
    replay: {
      selectedSessionId: null,
      liveTransport: null,
    },
    caseWiki: null,
    screenshotPath: null,
    summary: "browser direct-live smoke failed before completion",
  };
  const args = parseArgs(process.argv.slice(2));
  const outputPath = await writeJson(args.output, fallback);
  process.stdout.write(`${JSON.stringify({ ...fallback, outputPath })}\n`);
  console.error(error);
  process.exitCode = 1;
});
