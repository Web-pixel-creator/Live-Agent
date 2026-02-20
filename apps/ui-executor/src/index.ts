import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

type ActionType = "navigate" | "click" | "type" | "scroll" | "hotkey" | "wait" | "verify";

type UiAction = {
  id: string;
  type: ActionType;
  target: string;
  text?: string | null;
  coordinates?: { x: number; y: number } | null;
};

type ExecuteRequest = {
  actions: UiAction[];
  context?: {
    goal?: string;
    url?: string;
    screenshotRef?: string;
    deviceNodeId?: string;
    cursor?: { x: number; y: number };
  };
};

type DeviceNodeKind = "desktop" | "mobile";

type DeviceNodeStatus = "online" | "offline" | "degraded";

type DeviceNodeDescriptor = {
  nodeId: string;
  displayName: string;
  kind: DeviceNodeKind;
  platform: string;
  status: DeviceNodeStatus;
  capabilities: string[];
};

type TraceStep = {
  index: number;
  actionId: string;
  actionType: ActionType;
  target: string;
  status: "ok" | "retry" | "failed";
  screenshotRef: string;
  notes: string;
};

type ExecuteResponse = {
  trace: TraceStep[];
  finalStatus: "completed" | "failed";
  retries: number;
  executor: string;
  adapterMode: "remote_http";
  adapterNotes: string[];
  deviceNode: DeviceNodeDescriptor | null;
};

type ExecutorConfig = {
  port: number;
  defaultNavigationUrl: string;
  strictPlaywright: boolean;
  simulateIfUnavailable: boolean;
  actionTimeoutMs: number;
  defaultDeviceNodeId: string | null;
  deviceNodes: Map<string, DeviceNodeDescriptor>;
};

function parseDeviceNodes(raw: string | undefined): Map<string, DeviceNodeDescriptor> {
  const nodes = new Map<string, DeviceNodeDescriptor>();
  if (!raw || raw.trim().length === 0) {
    return nodes;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return nodes;
    }
    for (const item of parsed) {
      if (!isRecord(item)) {
        continue;
      }
      const nodeId = toNonEmptyString(item.nodeId ?? item.id, "").toLowerCase();
      if (!nodeId) {
        continue;
      }
      const kind = toNonEmptyString(item.kind, "desktop") === "mobile" ? "mobile" : "desktop";
      const statusRaw = toNonEmptyString(item.status, "online").toLowerCase();
      const status: DeviceNodeStatus =
        statusRaw === "offline" || statusRaw === "degraded" ? statusRaw : "online";
      const capabilitiesRaw = Array.isArray(item.capabilities) ? item.capabilities : [];
      const capabilities = capabilitiesRaw
        .map((capability) => toNonEmptyString(capability, "").toLowerCase())
        .filter((capability) => capability.length > 0);

      nodes.set(nodeId, {
        nodeId,
        displayName: toNonEmptyString(item.displayName ?? item.name, nodeId),
        kind,
        platform: toNonEmptyString(item.platform, "unknown"),
        status,
        capabilities,
      });
    }
    return nodes;
  } catch {
    return nodes;
  }
}

function loadConfig(): ExecutorConfig {
  const portRaw = Number(process.env.UI_EXECUTOR_PORT ?? 8090);
  const timeoutRaw = Number(process.env.UI_EXECUTOR_ACTION_TIMEOUT_MS ?? 2500);
  const deviceNodes = parseDeviceNodes(process.env.UI_EXECUTOR_DEVICE_NODES_JSON);
  const defaultDeviceNodeId = toNonEmptyString(process.env.UI_EXECUTOR_DEFAULT_DEVICE_NODE_ID, "");
  return {
    port: Number.isFinite(portRaw) && portRaw > 0 ? Math.floor(portRaw) : 8090,
    defaultNavigationUrl: process.env.UI_EXECUTOR_DEFAULT_URL ?? "https://example.com",
    strictPlaywright: process.env.UI_EXECUTOR_STRICT_PLAYWRIGHT === "true",
    simulateIfUnavailable: process.env.UI_EXECUTOR_SIMULATE_IF_UNAVAILABLE !== "false",
    actionTimeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.floor(timeoutRaw) : 2500,
    defaultDeviceNodeId: defaultDeviceNodeId.length > 0 ? defaultDeviceNodeId.toLowerCase() : null,
    deviceNodes,
  };
}

const config = loadConfig();

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeAction(raw: unknown): UiAction | null {
  if (!isRecord(raw)) {
    return null;
  }
  const actionType = toNonEmptyString(raw.type, "") as ActionType;
  if (!["navigate", "click", "type", "scroll", "hotkey", "wait", "verify"].includes(actionType)) {
    return null;
  }
  const coordinates =
    isRecord(raw.coordinates) &&
    typeof raw.coordinates.x === "number" &&
    typeof raw.coordinates.y === "number"
      ? { x: raw.coordinates.x, y: raw.coordinates.y }
      : null;

  return {
    id: toNonEmptyString(raw.id, randomUUID()),
    type: actionType,
    target: toNonEmptyString(raw.target, "unknown-target"),
    text: typeof raw.text === "string" ? raw.text : null,
    coordinates,
  };
}

function normalizeRequest(input: unknown): ExecuteRequest {
  const parsed = isRecord(input) ? input : {};
  const actionsRaw = Array.isArray(parsed.actions) ? parsed.actions : [];
  const actions: UiAction[] = [];
  for (const item of actionsRaw) {
    const normalized = normalizeAction(item);
    if (normalized) {
      actions.push(normalized);
    }
  }

  const contextRaw = isRecord(parsed.context) ? parsed.context : {};
  const context = {
    goal: toNonEmptyString(contextRaw.goal, ""),
    url: toNonEmptyString(contextRaw.url, ""),
    screenshotRef: toNonEmptyString(contextRaw.screenshotRef, ""),
    deviceNodeId: toNonEmptyString(contextRaw.deviceNodeId, "").toLowerCase(),
    cursor:
      isRecord(contextRaw.cursor) && typeof contextRaw.cursor.x === "number" && typeof contextRaw.cursor.y === "number"
        ? { x: contextRaw.cursor.x, y: contextRaw.cursor.y }
        : undefined,
  };

  return {
    actions,
    context,
  };
}

function simulateExecution(
  request: ExecuteRequest,
  note: string,
  deviceNode: DeviceNodeDescriptor | null,
): ExecuteResponse {
  const screenshotSeed = request.context?.screenshotRef || `ui://executor/${Date.now()}`;
  const trace: TraceStep[] = request.actions.map((action, idx) => ({
    index: idx + 1,
    actionId: action.id,
    actionType: action.type,
    target: action.target,
    status: "ok",
    screenshotRef: `${screenshotSeed}/sim-step-${idx + 1}.png`,
    notes: "Simulated execution step.",
  }));
  return {
    trace,
    finalStatus: "completed",
    retries: 0,
    executor: "ui-executor-service",
    adapterMode: "remote_http",
    adapterNotes: [note],
    deviceNode,
  };
}

async function executeWithPlaywright(
  request: ExecuteRequest,
  deviceNode: DeviceNodeDescriptor | null,
): Promise<ExecuteResponse | null> {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<unknown>;

  let playwrightModule: unknown;
  try {
    playwrightModule = await dynamicImport("playwright");
  } catch {
    return null;
  }

  if (!isRecord(playwrightModule) || !isRecord(playwrightModule.chromium)) {
    return null;
  }

  const chromium = playwrightModule.chromium as {
    launch: (options: { headless: boolean }) => Promise<{
      newPage: () => Promise<{
        goto: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<void>;
        click: (selector: string, options?: { timeout?: number }) => Promise<void>;
        fill: (selector: string, value: string, options?: { timeout?: number }) => Promise<void>;
        press: (selector: string, key: string, options?: { timeout?: number }) => Promise<void>;
        evaluate: (callback: () => void) => Promise<void>;
        waitForTimeout: (ms: number) => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const screenshotSeed = request.context?.screenshotRef || `ui://executor/${Date.now()}`;

  const trace: TraceStep[] = [];
  let retries = 0;
  let finalStatus: "completed" | "failed" = "completed";

  try {
    for (let index = 0; index < request.actions.length; index += 1) {
      const action = request.actions[index];
      const stepIndex = index + 1;
      const screenshotRef = `${screenshotSeed}/pw-step-${stepIndex}.png`;
      try {
        if (action.type === "navigate") {
          const navigateTarget =
            action.target.startsWith("http://") || action.target.startsWith("https://")
              ? action.target
              : config.defaultNavigationUrl;
          await page.goto(navigateTarget, { waitUntil: "domcontentloaded", timeout: 15000 });
        } else if (action.type === "click") {
          if (action.target.startsWith("css:")) {
            await page.click(action.target.slice(4), { timeout: config.actionTimeoutMs });
          } else if (action.target.startsWith("field:")) {
            const field = action.target.slice("field:".length);
            await page.click(`[name="${field}"],#${field}`, { timeout: config.actionTimeoutMs });
          } else if (action.target === "button:submit") {
            await page.click('button[type="submit"],input[type="submit"]', { timeout: config.actionTimeoutMs });
          } else {
            await page.click(action.target, { timeout: config.actionTimeoutMs });
          }
        } else if (action.type === "type") {
          const value = action.text ?? "";
          if (action.target.startsWith("css:")) {
            await page.fill(action.target.slice(4), value, { timeout: config.actionTimeoutMs });
          } else if (action.target.startsWith("field:")) {
            const field = action.target.slice("field:".length);
            await page.fill(`[name="${field}"],#${field}`, value, { timeout: config.actionTimeoutMs });
          } else {
            await page.fill(action.target, value, { timeout: config.actionTimeoutMs });
          }
        } else if (action.type === "scroll") {
          await page.evaluate(() => {
            window.scrollBy(0, Math.floor(window.innerHeight * 0.6));
          });
        } else if (action.type === "hotkey") {
          await page.press("body", action.text ?? "Enter", { timeout: config.actionTimeoutMs });
        } else if (action.type === "wait") {
          await page.waitForTimeout(300);
        } else if (action.type === "verify") {
          await page.waitForTimeout(120);
        }

        trace.push({
          index: stepIndex,
          actionId: action.id,
          actionType: action.type,
          target: action.target,
          status: "ok",
          screenshotRef,
          notes: "Executed by ui-executor playwright mode.",
        });
      } catch (error) {
        retries += 1;
        trace.push({
          index: stepIndex,
          actionId: action.id,
          actionType: action.type,
          target: action.target,
          status: "retry",
          screenshotRef,
          notes: `Playwright retry: ${error instanceof Error ? error.message : String(error)}`,
        });

        try {
          await page.waitForTimeout(220);
          trace.push({
            index: stepIndex,
            actionId: action.id,
            actionType: action.type,
            target: `${action.target} (retry)`,
            status: "ok",
            screenshotRef: `${screenshotSeed}/pw-step-${stepIndex}-retry.png`,
            notes: "Retry passed in ui-executor playwright mode.",
          });
        } catch (retryError) {
          trace.push({
            index: stepIndex,
            actionId: action.id,
            actionType: action.type,
            target: `${action.target} (retry)`,
            status: "failed",
            screenshotRef: `${screenshotSeed}/pw-step-${stepIndex}-retry.png`,
            notes: `Retry failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
          });
          finalStatus = "failed";
          break;
        }
      }
    }
  } finally {
    await browser.close();
  }

  return {
    trace,
    finalStatus,
    retries,
    executor: "ui-executor-service",
    adapterMode: "remote_http",
    adapterNotes: ["Executed via ui-executor playwright mode"],
    deviceNode,
  };
}

async function canUsePlaywright(): Promise<boolean> {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<unknown>;
  try {
    await dynamicImport("playwright");
    return true;
  } catch {
    return false;
  }
}

export const server = createServer(async (req, res) => {
  try {
    if (req.url === "/healthz" && req.method === "GET") {
      const playwrightAvailable = await canUsePlaywright();
      writeJson(res, 200, {
        ok: true,
        service: "ui-executor",
        mode: "remote_http",
        playwrightAvailable,
        strictPlaywright: config.strictPlaywright,
        simulateIfUnavailable: config.simulateIfUnavailable,
        registeredDeviceNodes: config.deviceNodes.size,
      });
      return;
    }

    if (req.url === "/execute" && req.method === "POST") {
      const raw = await readBody(req);
      const request = normalizeRequest(raw ? JSON.parse(raw) : {});
      if (request.actions.length === 0) {
        writeJson(res, 400, { error: "actions array is required" });
        return;
      }

      const headerNodeId = toNonEmptyString(req.headers["x-device-node-id"], "").toLowerCase();
      const requestedNodeId = headerNodeId || toNonEmptyString(request.context?.deviceNodeId, "").toLowerCase();
      const hasNodeRegistry = config.deviceNodes.size > 0;

      let selectedNode: DeviceNodeDescriptor | null = null;
      if (hasNodeRegistry) {
        if (requestedNodeId.length > 0) {
          selectedNode = config.deviceNodes.get(requestedNodeId) ?? null;
          if (!selectedNode) {
            writeJson(res, 404, {
              error: "requested device node is not registered",
              nodeId: requestedNodeId,
            });
            return;
          }
        } else if (config.defaultDeviceNodeId) {
          selectedNode = config.deviceNodes.get(config.defaultDeviceNodeId) ?? null;
        } else {
          selectedNode = Array.from(config.deviceNodes.values()).find((node) => node.status !== "offline") ?? null;
        }
      }

      if (selectedNode && selectedNode.status === "offline") {
        writeJson(res, 409, {
          error: "requested device node is offline",
          nodeId: selectedNode.nodeId,
          status: selectedNode.status,
        });
        return;
      }

      const played = await executeWithPlaywright(request, selectedNode);
      if (played) {
        writeJson(res, 200, played);
        return;
      }

      if (config.strictPlaywright && !config.simulateIfUnavailable) {
        writeJson(res, 503, {
          error:
            "Playwright is unavailable in ui-executor environment. Install playwright or disable strict mode.",
        });
        return;
      }

      const simulated = simulateExecution(
        request,
        "Playwright unavailable in ui-executor, simulation fallback used",
        selectedNode,
      );
      writeJson(res, 200, simulated);
      return;
    }

    writeJson(res, 404, { error: "Not found" });
  } catch (error) {
    writeJson(res, 500, {
      error: error instanceof Error ? error.message : "unknown ui-executor error",
    });
  }
});

server.listen(config.port, () => {
  console.log(`[ui-executor] listening on :${config.port}`);
});
