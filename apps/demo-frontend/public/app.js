const state = {
  ws: null,
  wsUrl: "ws://localhost:8080/realtime",
  apiBaseUrl: "http://localhost:8081",
  userId: "",
  sessionId: "",
  runId: null,
  sessionState: "-",
  mode: "voice",
  fallbackAsset: false,
  pendingApproval: null,
  audioContext: null,
  nextPlayTime: 0,
  micContext: null,
  micStream: null,
  micProcessor: null,
  micGain: null,
  taskRecords: new Map(),
  deviceNodes: new Map(),
  selectedDeviceNodeId: null,
};

const el = {
  wsUrl: document.getElementById("wsUrl"),
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  userId: document.getElementById("userId"),
  sessionId: document.getElementById("sessionId"),
  targetLanguage: document.getElementById("targetLanguage"),
  connectionStatus: document.getElementById("connectionStatus"),
  runId: document.getElementById("runId"),
  currentUserId: document.getElementById("currentUserId"),
  sessionState: document.getElementById("sessionState"),
  modeStatus: document.getElementById("modeStatus"),
  approvalId: document.getElementById("approvalId"),
  approvalReason: document.getElementById("approvalReason"),
  approvalStatus: document.getElementById("approvalStatus"),
  intent: document.getElementById("intent"),
  message: document.getElementById("message"),
  transcript: document.getElementById("transcript"),
  events: document.getElementById("events"),
  targetPrice: document.getElementById("targetPrice"),
  targetDelivery: document.getElementById("targetDelivery"),
  targetSla: document.getElementById("targetSla"),
  currentPrice: document.getElementById("currentPrice"),
  currentDelivery: document.getElementById("currentDelivery"),
  currentSla: document.getElementById("currentSla"),
  finalPrice: document.getElementById("finalPrice"),
  finalDelivery: document.getElementById("finalDelivery"),
  finalSla: document.getElementById("finalSla"),
  constraintStatus: document.getElementById("constraintStatus"),
  fallbackAssetStatus: document.getElementById("fallbackAssetStatus"),
  activeTaskCount: document.getElementById("activeTaskCount"),
  tasks: document.getElementById("tasks"),
  operatorRole: document.getElementById("operatorRole"),
  operatorTaskId: document.getElementById("operatorTaskId"),
  operatorTargetService: document.getElementById("operatorTargetService"),
  operatorSummary: document.getElementById("operatorSummary"),
  operatorHealthStatus: document.getElementById("operatorHealthStatus"),
  operatorHealthState: document.getElementById("operatorHealthState"),
  operatorHealthLastEventType: document.getElementById("operatorHealthLastEventType"),
  operatorHealthLastEventAt: document.getElementById("operatorHealthLastEventAt"),
  operatorHealthDegraded: document.getElementById("operatorHealthDegraded"),
  operatorHealthRecovered: document.getElementById("operatorHealthRecovered"),
  operatorHealthWatchdogReconnects: document.getElementById("operatorHealthWatchdogReconnects"),
  operatorHealthErrors: document.getElementById("operatorHealthErrors"),
  operatorHealthUnavailable: document.getElementById("operatorHealthUnavailable"),
  operatorHealthConnectTimeouts: document.getElementById("operatorHealthConnectTimeouts"),
  operatorHealthProbes: document.getElementById("operatorHealthProbes"),
  operatorHealthPingSent: document.getElementById("operatorHealthPingSent"),
  operatorHealthPongs: document.getElementById("operatorHealthPongs"),
  operatorHealthPingErrors: document.getElementById("operatorHealthPingErrors"),
  operatorHealthProbeSuccess: document.getElementById("operatorHealthProbeSuccess"),
  deviceNodeId: document.getElementById("deviceNodeId"),
  deviceNodeDisplayName: document.getElementById("deviceNodeDisplayName"),
  deviceNodeKind: document.getElementById("deviceNodeKind"),
  deviceNodePlatform: document.getElementById("deviceNodePlatform"),
  deviceNodeExecutorUrl: document.getElementById("deviceNodeExecutorUrl"),
  deviceNodeStatus: document.getElementById("deviceNodeStatus"),
  deviceNodeTrustLevel: document.getElementById("deviceNodeTrustLevel"),
  deviceNodeExpectedVersion: document.getElementById("deviceNodeExpectedVersion"),
  deviceNodeCapabilities: document.getElementById("deviceNodeCapabilities"),
  deviceNodeMetadata: document.getElementById("deviceNodeMetadata"),
  deviceNodeCount: document.getElementById("deviceNodeCount"),
  deviceNodeSelectedStatus: document.getElementById("deviceNodeSelectedStatus"),
  deviceNodeSelectedVersion: document.getElementById("deviceNodeSelectedVersion"),
  deviceNodeSelectedLastSeen: document.getElementById("deviceNodeSelectedLastSeen"),
  deviceNodeList: document.getElementById("deviceNodeList"),
};

function nowLabel() {
  return new Date().toLocaleTimeString();
}

function makeId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function setConnectionStatus(text) {
  el.connectionStatus.textContent = text;
}

function setSessionState(text) {
  state.sessionState = text;
  el.sessionState.textContent = text;
}

function setMode(mode) {
  state.mode = mode;
  el.modeStatus.textContent = mode;
}

function normalizeApiBaseUrl(value) {
  if (typeof value !== "string") {
    return state.apiBaseUrl;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return state.apiBaseUrl;
  }
  return trimmed.replace(/\/+$/, "");
}

function toOptionalText(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeDeviceNode(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const nodeId = toOptionalText(value.nodeId);
  if (!nodeId) {
    return null;
  }
  const status = toOptionalText(value.status) ?? "online";
  const kind = toOptionalText(value.kind) ?? "desktop";
  const displayName = toOptionalText(value.displayName) ?? nodeId;
  const capabilities = Array.isArray(value.capabilities)
    ? value.capabilities.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  return {
    nodeId,
    displayName,
    kind,
    platform: toOptionalText(value.platform) ?? "unknown",
    executorUrl: toOptionalText(value.executorUrl),
    status,
    trustLevel: toOptionalText(value.trustLevel) ?? "reviewed",
    version: typeof value.version === "number" ? value.version : null,
    lastSeenAt: toOptionalText(value.lastSeenAt),
    updatedAt: toOptionalText(value.updatedAt),
    capabilities,
  };
}

function parseCapabilitiesCsv(value) {
  if (typeof value !== "string") {
    return [];
  }
  const seen = new Set();
  const deduped = [];
  for (const item of value.split(",")) {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

function parseOptionalMetadataJson(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return JSON.parse(value);
}

function appendEntry(container, kind, title, message) {
  const entry = document.createElement("div");
  entry.className = `entry ${kind}`;
  const titleNode = document.createElement("small");
  titleNode.textContent = `${nowLabel()} - ${title}`;
  const bodyNode = document.createElement("div");
  bodyNode.textContent = message;
  entry.appendChild(titleNode);
  entry.appendChild(bodyNode);
  container.prepend(entry);
}

function appendTranscript(role, text) {
  appendEntry(el.transcript, role === "error" ? "error" : "system", role, text);
}

function appendEvent(type, text) {
  appendEntry(el.events, "system", type, text);
}

function normalizeTaskRecord(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const taskId = typeof value.taskId === "string" ? value.taskId : null;
  if (!taskId || taskId.trim().length === 0) {
    return null;
  }
  return {
    taskId: taskId.trim(),
    sessionId: typeof value.sessionId === "string" ? value.sessionId : state.sessionId,
    runId: typeof value.runId === "string" ? value.runId : null,
    intent: typeof value.intent === "string" ? value.intent : null,
    route: typeof value.route === "string" ? value.route : null,
    status: typeof value.status === "string" ? value.status : "running",
    progressPct: typeof value.progressPct === "number" ? value.progressPct : 0,
    stage: typeof value.stage === "string" ? value.stage : "unknown",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    error: typeof value.error === "string" ? value.error : null,
  };
}

function renderTaskList() {
  const records = [...state.taskRecords.values()].sort((left, right) =>
    String(right.updatedAt).localeCompare(String(left.updatedAt)),
  );
  el.activeTaskCount.textContent = String(records.length);
  el.tasks.innerHTML = "";

  if (records.length === 0) {
    appendEntry(el.tasks, "system", "task", "No active tasks");
    return;
  }

  for (const task of records) {
    const summary = [
      `status=${task.status}`,
      `progress=${typeof task.progressPct === "number" ? task.progressPct : 0}%`,
      `stage=${task.stage ?? "unknown"}`,
      task.intent ? `intent=${task.intent}` : null,
      task.route ? `route=${task.route}` : null,
      task.error ? `error=${task.error}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    appendEntry(el.tasks, "system", task.taskId, summary);
  }
}

function upsertTaskRecord(value) {
  const normalized = normalizeTaskRecord(value);
  if (!normalized) {
    return;
  }
  state.taskRecords.set(normalized.taskId, normalized);
  renderTaskList();
}

function removeTaskRecord(taskId) {
  if (typeof taskId !== "string" || taskId.trim().length === 0) {
    return;
  }
  state.taskRecords.delete(taskId.trim());
  renderTaskList();
}

function formatMs(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${Math.round(value)}ms`;
}

function setStatusPill(node, text, variant) {
  if (!node) {
    return;
  }
  node.textContent = text;
  node.className = "status-pill";
  if (variant === "ok") {
    node.classList.add("status-ok");
    return;
  }
  if (variant === "fail") {
    node.classList.add("status-fail");
    return;
  }
  node.classList.add("status-neutral");
}

function getNumeric(inputEl) {
  const value = Number(inputEl.value);
  return Number.isFinite(value) ? value : null;
}

function setMaybeValue(node, value, suffix = "") {
  node.textContent = value === null || value === undefined ? "-" : `${value}${suffix}`;
}

function setText(node, value) {
  if (!node) {
    return;
  }
  node.textContent = value;
}

function resetOperatorHealthWidget(reason = "no_data") {
  setText(el.operatorHealthState, "unknown");
  setText(el.operatorHealthLastEventType, "-");
  setText(el.operatorHealthLastEventAt, "-");
  setText(el.operatorHealthDegraded, "0");
  setText(el.operatorHealthRecovered, "0");
  setText(el.operatorHealthWatchdogReconnects, "0");
  setText(el.operatorHealthErrors, "0");
  setText(el.operatorHealthUnavailable, "0");
  setText(el.operatorHealthConnectTimeouts, "0");
  setText(el.operatorHealthProbes, "0");
  setText(el.operatorHealthPingSent, "0");
  setText(el.operatorHealthPongs, "0");
  setText(el.operatorHealthPingErrors, "0");
  setText(el.operatorHealthProbeSuccess, "n/a");
  setStatusPill(el.operatorHealthStatus, reason, reason === "summary_error" ? "fail" : "neutral");
}

function renderOperatorHealthWidget(liveBridgeHealth) {
  if (!liveBridgeHealth || typeof liveBridgeHealth !== "object") {
    resetOperatorHealthWidget("no_data");
    return;
  }

  const bridgeState = typeof liveBridgeHealth.state === "string" ? liveBridgeHealth.state : "unknown";
  const degraded = Number(liveBridgeHealth.degradedEvents ?? 0);
  const recovered = Number(liveBridgeHealth.recoveredEvents ?? 0);
  const watchdogReconnects = Number(liveBridgeHealth.watchdogReconnectEvents ?? 0);
  const errors = Number(liveBridgeHealth.bridgeErrorEvents ?? 0);
  const unavailable = Number(liveBridgeHealth.unavailableEvents ?? 0);
  const connectTimeouts = Number(liveBridgeHealth.connectTimeoutEvents ?? 0);
  const probes = Number(liveBridgeHealth.probeStartedEvents ?? 0);
  const pingSent = Number(liveBridgeHealth.pingSentEvents ?? 0);
  const pongs = Number(liveBridgeHealth.pongEvents ?? 0);
  const pingErrors = Number(liveBridgeHealth.pingErrorEvents ?? 0);
  const lastEventType = typeof liveBridgeHealth.lastEventType === "string" ? liveBridgeHealth.lastEventType : "-";
  const lastEventAt = typeof liveBridgeHealth.lastEventAt === "string" ? liveBridgeHealth.lastEventAt : "-";
  const probeSuccessPct = pingSent > 0 ? Math.round((pongs / pingSent) * 100) : null;
  const probeSuccessText = probeSuccessPct === null ? "n/a" : `${probeSuccessPct}%`;

  setText(el.operatorHealthState, bridgeState);
  setText(el.operatorHealthLastEventType, lastEventType);
  setText(el.operatorHealthLastEventAt, lastEventAt);
  setText(el.operatorHealthDegraded, String(degraded));
  setText(el.operatorHealthRecovered, String(recovered));
  setText(el.operatorHealthWatchdogReconnects, String(watchdogReconnects));
  setText(el.operatorHealthErrors, String(errors));
  setText(el.operatorHealthUnavailable, String(unavailable));
  setText(el.operatorHealthConnectTimeouts, String(connectTimeouts));
  setText(el.operatorHealthProbes, String(probes));
  setText(el.operatorHealthPingSent, String(pingSent));
  setText(el.operatorHealthPongs, String(pongs));
  setText(el.operatorHealthPingErrors, String(pingErrors));
  setText(el.operatorHealthProbeSuccess, probeSuccessText);

  let statusVariant = "ok";
  if (bridgeState === "degraded" || unavailable > 0 || errors > 0) {
    statusVariant = "fail";
  } else if (bridgeState === "unknown" || pingErrors > 0 || (pingSent > 0 && pongs < pingSent)) {
    statusVariant = "neutral";
  }
  const statusText = probeSuccessPct === null ? `state=${bridgeState}` : `state=${bridgeState} probe=${probeSuccessText}`;
  setStatusPill(el.operatorHealthStatus, statusText, statusVariant);
}

function extractNumber(text, regex) {
  const match = text.match(regex);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function updateOfferFromText(text, isFinal = false) {
  const price = extractNumber(text, /price\D{0,10}(\d+(?:[.,]\d+)?)/i);
  const delivery = extractNumber(text, /delivery\D{0,10}(\d+(?:[.,]\d+)?)/i);
  const sla = extractNumber(text, /sla\D{0,10}(\d+(?:[.,]\d+)?)/i);

  if (isFinal) {
    if (price !== null) {
      setMaybeValue(el.finalPrice, price);
    }
    if (delivery !== null) {
      setMaybeValue(el.finalDelivery, delivery);
    }
    if (sla !== null) {
      setMaybeValue(el.finalSla, sla, "%");
    }
  } else {
    if (price !== null) {
      setMaybeValue(el.currentPrice, price);
    }
    if (delivery !== null) {
      setMaybeValue(el.currentDelivery, delivery);
    }
    if (sla !== null) {
      setMaybeValue(el.currentSla, sla, "%");
    }
  }
}

function parseDisplayedNumber(node) {
  const cleaned = node.textContent.replace("%", "").trim();
  if (cleaned === "-" || cleaned.length === 0) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateConstraints() {
  const targetPrice = getNumeric(el.targetPrice);
  const targetDelivery = getNumeric(el.targetDelivery);
  const targetSla = getNumeric(el.targetSla);

  const price = parseDisplayedNumber(el.finalPrice) ?? parseDisplayedNumber(el.currentPrice);
  const delivery = parseDisplayedNumber(el.finalDelivery) ?? parseDisplayedNumber(el.currentDelivery);
  const sla = parseDisplayedNumber(el.finalSla) ?? parseDisplayedNumber(el.currentSla);

  if (price === null || delivery === null || sla === null) {
    setStatusPill(el.constraintStatus, "Waiting for complete offer", "neutral");
    return;
  }

  const okPrice = targetPrice === null ? true : price <= targetPrice;
  const okDelivery = targetDelivery === null ? true : delivery <= targetDelivery;
  const okSla = targetSla === null ? true : sla >= targetSla;

  if (okPrice && okDelivery && okSla) {
    setStatusPill(el.constraintStatus, "Constraints satisfied", "ok");
  } else {
    setStatusPill(el.constraintStatus, "Constraints violated", "fail");
  }
}

function setFallbackAsset(value) {
  state.fallbackAsset = value;
  setStatusPill(
    el.fallbackAssetStatus,
    value ? "fallback_asset=true" : "fallback_asset=false",
    value ? "ok" : "neutral",
  );
}

function setApprovalStatus(text, variant = "neutral") {
  setStatusPill(el.approvalStatus, text, variant);
}

function clearPendingApproval(options = {}) {
  const keepStatus = options.keepStatus === true;
  state.pendingApproval = null;
  el.approvalId.value = "-";
  if (!keepStatus) {
    setApprovalStatus("idle", "neutral");
  }
}

function setPendingApproval(params) {
  const approvalId = typeof params?.approvalId === "string" ? params.approvalId : null;
  if (!approvalId) {
    return;
  }
  state.pendingApproval = {
    approvalId,
    intent: params.intent === "ui_task" ? "ui_task" : "ui_task",
    input: params.input && typeof params.input === "object" ? params.input : {},
  };
  el.approvalId.value = approvalId;
  setApprovalStatus("pending_approval", "fail");
}

function createEnvelope(type, payload, source = "frontend", runId = state.runId) {
  return {
    id: makeId(),
    userId: state.userId,
    sessionId: state.sessionId,
    runId: runId ?? undefined,
    type,
    source,
    ts: new Date().toISOString(),
    payload,
  };
}

function sendEnvelope(type, payload, source = "frontend", runId = state.runId) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    appendTranscript("error", "WebSocket is not connected");
    return;
  }
  const envelope = createEnvelope(type, payload, source, runId);
  state.ws.send(JSON.stringify(envelope));
}

function gatewayHttpBaseFromWs(wsUrl) {
  if (typeof wsUrl !== "string" || wsUrl.trim().length === 0) {
    return "http://localhost:8080";
  }
  const normalized = wsUrl.trim();
  if (normalized.startsWith("wss://")) {
    return normalized.replace(/^wss:\/\//, "https://").replace(/\/realtime\/?$/, "");
  }
  if (normalized.startsWith("ws://")) {
    return normalized.replace(/^ws:\/\//, "http://").replace(/\/realtime\/?$/, "");
  }
  return "http://localhost:8080";
}

async function refreshActiveTasks() {
  const baseUrl = gatewayHttpBaseFromWs(el.wsUrl.value);
  const sessionId = state.sessionId?.trim();
  const params = new URLSearchParams();
  if (sessionId) {
    params.set("sessionId", sessionId);
  }
  params.set("limit", "50");
  const url = `${baseUrl}/tasks/active?${params.toString()}`;

  try {
    const response = await fetch(url, { method: "GET" });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `tasks/active failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const records = Array.isArray(payload?.data) ? payload.data : [];
    state.taskRecords.clear();
    for (const item of records) {
      upsertTaskRecord(item);
    }
    if (!el.operatorTaskId.value.trim() && records.length > 0 && typeof records[0]?.taskId === "string") {
      el.operatorTaskId.value = records[0].taskId;
    }
    renderTaskList();
    appendTranscript("system", `Active tasks refreshed: ${records.length}`);
  } catch (error) {
    appendTranscript("error", `Active tasks refresh failed: ${String(error)}`);
  }
}

function operatorHeaders(includeJson = false) {
  const role = (el.operatorRole.value || "operator").trim().toLowerCase();
  const headers = {
    "x-operator-role": role,
  };
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function renderOperatorSummary(summary) {
  el.operatorSummary.innerHTML = "";
  resetOperatorHealthWidget("no_data");
  if (!summary || typeof summary !== "object") {
    appendEntry(el.operatorSummary, "error", "operator.summary", "No summary data");
    return;
  }

  const role = typeof summary.role === "string" ? summary.role : "unknown";
  const generatedAt = typeof summary.generatedAt === "string" ? summary.generatedAt : new Date().toISOString();
  appendEntry(el.operatorSummary, "system", "summary", `role=${role} generatedAt=${generatedAt}`);

  const activeTasks = summary.activeTasks?.data;
  const activeTotal = Number(summary.activeTasks?.total ?? 0);
  appendEntry(el.operatorSummary, "system", "tasks", `active=${activeTotal}`);
  if (Array.isArray(activeTasks) && activeTasks.length > 0) {
    const firstTask = activeTasks.find((item) => item && typeof item.taskId === "string");
    if (firstTask && !el.operatorTaskId.value.trim()) {
      el.operatorTaskId.value = firstTask.taskId;
    }
  }

  const pendingApprovals = Number(summary.approvals?.pendingFromTasks ?? 0);
  const approvalsTotal = Number(summary.approvals?.total ?? 0);
  appendEntry(
    el.operatorSummary,
    "system",
    "approvals",
    `recorded=${approvalsTotal} pending_from_tasks=${pendingApprovals}`,
  );

  const operatorActions = summary.operatorActions && typeof summary.operatorActions === "object"
    ? summary.operatorActions
    : null;
  if (operatorActions) {
    const actionTotal = Number(operatorActions.total ?? 0);
    appendEntry(el.operatorSummary, "system", "operator_actions", `recorded=${actionTotal}`);
    const recentActions = Array.isArray(operatorActions.recent) ? operatorActions.recent : [];
    for (const item of recentActions.slice(0, 4)) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const action = typeof item.action === "string" ? item.action : "action";
      const outcome = typeof item.outcome === "string" ? item.outcome : "unknown";
      const actorRole = typeof item.actorRole === "string" ? item.actorRole : "unknown";
      const taskId = typeof item.taskId === "string" ? item.taskId : "-";
      appendEntry(
        el.operatorSummary,
        "system",
        `audit.${action}`,
        `role=${actorRole} outcome=${outcome} task=${taskId}`,
      );
    }
  }

  const traces = summary.traces && typeof summary.traces === "object" ? summary.traces : null;
  let liveBridgeHealthForWidget = null;
  if (traces) {
    const totals = traces.totals && typeof traces.totals === "object" ? traces.totals : {};
    const traceRuns = Number(totals.runsConsidered ?? 0);
    const traceEvents = Number(totals.eventsConsidered ?? 0);
    const uiTraceRuns = Number(totals.uiTraceRuns ?? 0);
    const traceApprovals = Number(totals.approvalLinkedRuns ?? 0);
    const traceSteps = Number(totals.traceSteps ?? 0);
    const screenshotRefs = Number(totals.screenshotRefs ?? 0);
    appendEntry(
      el.operatorSummary,
      "system",
      "traces",
      `runs=${traceRuns} events=${traceEvents} ui_runs=${uiTraceRuns} approvals=${traceApprovals} steps=${traceSteps} screenshots=${screenshotRefs}`,
    );

    const recentRuns = Array.isArray(traces.recentRuns) ? traces.recentRuns : [];
    for (const run of recentRuns.slice(0, 5)) {
      if (!run || typeof run !== "object") {
        continue;
      }
      const runId = typeof run.runId === "string" ? run.runId : "run";
      const runRoute = typeof run.route === "string" ? run.route : "unknown";
      const runStatus = typeof run.status === "string" ? run.status : "unknown";
      const runEvents = Number(run.eventCount ?? 0);
      const runTraceSteps = Number(run.traceSteps ?? 0);
      const runShots = Number(run.screenshotRefs ?? 0);
      const runApproval = typeof run.approvalStatus === "string" ? run.approvalStatus : "-";
      appendEntry(
        el.operatorSummary,
        "system",
        `trace.${runId.slice(0, 12)}`,
        `route=${runRoute} status=${runStatus} events=${runEvents} steps=${runTraceSteps} screenshots=${runShots} approval=${runApproval}`,
      );
    }

    const liveBridgeHealth = traces.liveBridgeHealth && typeof traces.liveBridgeHealth === "object"
      ? traces.liveBridgeHealth
      : null;
    if (liveBridgeHealth) {
      liveBridgeHealthForWidget = liveBridgeHealth;
      const bridgeState = typeof liveBridgeHealth.state === "string" ? liveBridgeHealth.state : "unknown";
      const degraded = Number(liveBridgeHealth.degradedEvents ?? 0);
      const recovered = Number(liveBridgeHealth.recoveredEvents ?? 0);
      const watchdogReconnects = Number(liveBridgeHealth.watchdogReconnectEvents ?? 0);
      const errors = Number(liveBridgeHealth.bridgeErrorEvents ?? 0);
      const unavailable = Number(liveBridgeHealth.unavailableEvents ?? 0);
      const connectTimeouts = Number(liveBridgeHealth.connectTimeoutEvents ?? 0);
      const probeStarted = Number(liveBridgeHealth.probeStartedEvents ?? 0);
      const pingSent = Number(liveBridgeHealth.pingSentEvents ?? 0);
      const pongs = Number(liveBridgeHealth.pongEvents ?? 0);
      const pingErrors = Number(liveBridgeHealth.pingErrorEvents ?? 0);
      const lastEventType = typeof liveBridgeHealth.lastEventType === "string" ? liveBridgeHealth.lastEventType : "-";
      const lastEventAt = typeof liveBridgeHealth.lastEventAt === "string" ? liveBridgeHealth.lastEventAt : "-";
      const probeSuccessPct = pingSent > 0 ? Math.round((pongs / pingSent) * 100) : null;
      const probeSuccessText = probeSuccessPct === null ? "n/a" : `${probeSuccessPct}%`;

      appendEntry(
        el.operatorSummary,
        bridgeState === "degraded" ? "error" : "system",
        "live_bridge_health",
        `state=${bridgeState} degraded=${degraded} recovered=${recovered} watchdog_reconnects=${watchdogReconnects} errors=${errors} unavailable=${unavailable} connect_timeouts=${connectTimeouts} probes=${probeStarted} ping_sent=${pingSent} pongs=${pongs} ping_errors=${pingErrors} probe_success=${probeSuccessText} last=${lastEventType}@${lastEventAt}`,
      );
    }
  }
  renderOperatorHealthWidget(liveBridgeHealthForWidget);

  const services = Array.isArray(summary.services) ? summary.services : [];
  for (const service of services) {
    const name = typeof service.name === "string" ? service.name : "service";
    const healthy = service.healthy === true ? "healthy" : "unavailable";
    const state = typeof service.state === "string" ? service.state : "unknown";
    const profile = service.profile?.profile || "n/a";
    const env = service.profile?.environment || "n/a";
    appendEntry(el.operatorSummary, "system", name, `${healthy} | state=${state} | profile=${profile}/${env}`);
  }
}

async function refreshOperatorSummary() {
  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/operator/summary`, {
      method: "GET",
      headers: operatorHeaders(false),
    });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `operator summary failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    renderOperatorSummary(payload?.data ?? null);
    await refreshDeviceNodes({ silent: true });
    appendTranscript("system", "Operator summary refreshed");
  } catch (error) {
    resetOperatorHealthWidget("summary_error");
    appendTranscript("error", `Operator summary refresh failed: ${String(error)}`);
  }
}

async function runOperatorAction(action, data = {}) {
  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/operator/actions`, {
      method: "POST",
      headers: operatorHeaders(true),
      body: JSON.stringify({
        action,
        ...data,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `operator action failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    appendTranscript("system", `Operator action executed: ${action}`);
    if (payload?.data?.taskId && typeof payload.data.taskId === "string") {
      el.operatorTaskId.value = payload.data.taskId;
    }
    await refreshOperatorSummary();
  } catch (error) {
    appendTranscript("error", `Operator action failed (${action}): ${String(error)}`);
  }
}

function updateDeviceNodeSelectionMeta(node) {
  if (!node) {
    el.deviceNodeSelectedStatus.textContent = "-";
    el.deviceNodeSelectedVersion.textContent = "-";
    el.deviceNodeSelectedLastSeen.textContent = "-";
    return;
  }
  el.deviceNodeSelectedStatus.textContent = node.status ?? "-";
  el.deviceNodeSelectedVersion.textContent =
    typeof node.version === "number" && Number.isFinite(node.version) ? String(node.version) : "-";
  el.deviceNodeSelectedLastSeen.textContent = node.lastSeenAt ?? "-";
}

function applyDeviceNodeToForm(node) {
  if (!node) {
    updateDeviceNodeSelectionMeta(null);
    return;
  }
  state.selectedDeviceNodeId = node.nodeId.toLowerCase();
  el.deviceNodeId.value = node.nodeId;
  el.deviceNodeDisplayName.value = node.displayName ?? node.nodeId;
  el.deviceNodeKind.value = node.kind === "mobile" ? "mobile" : "desktop";
  el.deviceNodePlatform.value = node.platform ?? "";
  el.deviceNodeExecutorUrl.value = node.executorUrl ?? "";
  el.deviceNodeStatus.value =
    node.status === "offline" || node.status === "degraded" ? node.status : "online";
  el.deviceNodeTrustLevel.value =
    node.trustLevel === "trusted" || node.trustLevel === "untrusted" ? node.trustLevel : "reviewed";
  el.deviceNodeCapabilities.value = Array.isArray(node.capabilities) ? node.capabilities.join(",") : "";
  el.deviceNodeExpectedVersion.value =
    typeof node.version === "number" && Number.isFinite(node.version) ? String(node.version) : "";
  updateDeviceNodeSelectionMeta(node);
}

function renderDeviceNodeList(nodes) {
  const normalizedNodes = Array.isArray(nodes) ? nodes.map(normalizeDeviceNode).filter(Boolean) : [];
  state.deviceNodes.clear();
  for (const node of normalizedNodes) {
    state.deviceNodes.set(node.nodeId.toLowerCase(), node);
  }
  el.deviceNodeCount.textContent = String(normalizedNodes.length);
  el.deviceNodeList.innerHTML = "";

  if (normalizedNodes.length === 0) {
    appendEntry(el.deviceNodeList, "system", "device_nodes", "No registered device nodes");
    updateDeviceNodeSelectionMeta(null);
    return;
  }

  const selected = state.selectedDeviceNodeId
    ? state.deviceNodes.get(state.selectedDeviceNodeId.toLowerCase()) ?? normalizedNodes[0]
    : normalizedNodes[0];
  applyDeviceNodeToForm(selected);

  for (const node of normalizedNodes) {
    const status = toOptionalText(node.status) ?? "unknown";
    const capabilities = Array.isArray(node.capabilities) && node.capabilities.length > 0
      ? node.capabilities.join(",")
      : "none";
    const executor = node.executorUrl ?? "n/a";
    const version = typeof node.version === "number" ? node.version : "n/a";
    const message = [
      `name=${node.displayName}`,
      `kind=${node.kind}`,
      `status=${status}`,
      `platform=${node.platform ?? "unknown"}`,
      `version=${version}`,
      `trust=${node.trustLevel ?? "reviewed"}`,
      `caps=${capabilities}`,
      `executor=${executor}`,
      node.lastSeenAt ? `last_seen=${node.lastSeenAt}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    appendEntry(el.deviceNodeList, "system", node.nodeId, message);
  }
}

async function refreshDeviceNodes(options = {}) {
  const silent = options && options.silent === true;
  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/device-nodes?limit=200&includeOffline=true`, {
      method: "GET",
      headers: operatorHeaders(false),
    });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `device nodes list failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const nodes = Array.isArray(payload?.data) ? payload.data : [];
    renderDeviceNodeList(nodes);
    if (!silent) {
      appendTranscript("system", `Device nodes refreshed: ${nodes.length}`);
    }
  } catch (error) {
    appendTranscript("error", `Device nodes refresh failed: ${String(error)}`);
  }
}

async function fetchDeviceNodeStatusFromForm() {
  const nodeId = toOptionalText(el.deviceNodeId.value);
  if (!nodeId) {
    appendTranscript("error", "Device node nodeId is required for status check");
    return;
  }

  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/device-nodes/${encodeURIComponent(nodeId)}`, {
      method: "GET",
      headers: operatorHeaders(false),
    });
    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `device node status failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const node = normalizeDeviceNode(payload?.data);
    if (!node) {
      throw new Error("Device node response payload is invalid");
    }
    applyDeviceNodeToForm(node);
    appendTranscript("system", `Device node status loaded: ${node.nodeId} (${node.status ?? "unknown"})`);
  } catch (error) {
    appendTranscript("error", `Device node status check failed: ${String(error)}`);
  }
}

async function upsertDeviceNodeFromForm() {
  const nodeId = toOptionalText(el.deviceNodeId.value);
  const displayName = toOptionalText(el.deviceNodeDisplayName.value);
  if (!nodeId || !displayName) {
    appendTranscript("error", "Device node nodeId and displayName are required");
    return;
  }

  const expectedVersionValue = Number(el.deviceNodeExpectedVersion.value);
  const expectedVersion =
    Number.isFinite(expectedVersionValue) && expectedVersionValue >= 1
      ? Math.floor(expectedVersionValue)
      : null;

  let metadata = null;
  try {
    metadata = parseOptionalMetadataJson(el.deviceNodeMetadata.value);
  } catch (error) {
    appendTranscript("error", `Device node metadata JSON is invalid: ${String(error)}`);
    return;
  }

  const payload = {
    nodeId,
    displayName,
    kind: el.deviceNodeKind.value === "mobile" ? "mobile" : "desktop",
    platform: toOptionalText(el.deviceNodePlatform.value),
    executorUrl: toOptionalText(el.deviceNodeExecutorUrl.value),
    status:
      el.deviceNodeStatus.value === "offline" || el.deviceNodeStatus.value === "degraded"
        ? el.deviceNodeStatus.value
        : "online",
    capabilities: parseCapabilitiesCsv(el.deviceNodeCapabilities.value),
    trustLevel:
      el.deviceNodeTrustLevel.value === "trusted" || el.deviceNodeTrustLevel.value === "untrusted"
        ? el.deviceNodeTrustLevel.value
        : "reviewed",
    updatedBy: (el.operatorRole.value || "operator").trim().toLowerCase(),
  };

  if (expectedVersion !== null) {
    payload.expectedVersion = expectedVersion;
  }
  if (metadata !== null) {
    payload.metadata = metadata;
  }

  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/device-nodes`, {
      method: "POST",
      headers: operatorHeaders(true),
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(body, `device node upsert failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const node = normalizeDeviceNode(body?.data);
    if (node) {
      applyDeviceNodeToForm(node);
    }
    appendTranscript("system", `Device node upserted: ${nodeId}`);
    await refreshDeviceNodes({ silent: true });
  } catch (error) {
    appendTranscript("error", `Device node upsert failed: ${String(error)}`);
  }
}

async function sendDeviceNodeHeartbeatFromForm() {
  const nodeId = toOptionalText(el.deviceNodeId.value);
  if (!nodeId) {
    appendTranscript("error", "Device node nodeId is required for heartbeat");
    return;
  }

  let metadata = null;
  try {
    metadata = parseOptionalMetadataJson(el.deviceNodeMetadata.value);
  } catch (error) {
    appendTranscript("error", `Device node metadata JSON is invalid: ${String(error)}`);
    return;
  }

  const payload = {
    nodeId,
    status:
      el.deviceNodeStatus.value === "offline" || el.deviceNodeStatus.value === "degraded"
        ? el.deviceNodeStatus.value
        : "online",
  };
  if (metadata !== null) {
    payload.metadata = metadata;
  }

  try {
    const response = await fetch(`${state.apiBaseUrl}/v1/device-nodes/heartbeat`, {
      method: "POST",
      headers: operatorHeaders(true),
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(body, `device node heartbeat failed with ${response.status}`);
      throw new Error(String(errorText));
    }
    const node = normalizeDeviceNode(body?.data);
    if (node) {
      applyDeviceNodeToForm(node);
    }
    appendTranscript("system", `Device node heartbeat recorded: ${nodeId}`);
    await refreshDeviceNodes({ silent: true });
  } catch (error) {
    appendTranscript("error", `Device node heartbeat failed: ${String(error)}`);
  }
}

function decodeBase64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new AudioContext();
    state.nextPlayTime = 0;
  }
  return state.audioContext;
}

function playPcm16Chunk(samples, sampleRate = 16000) {
  const audioContext = ensureAudioContext();
  const floatData = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    floatData[i] = Math.max(-1, Math.min(1, samples[i] / 32768));
  }
  const buffer = audioContext.createBuffer(1, floatData.length, sampleRate);
  buffer.copyToChannel(floatData, 0);

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);

  const startAt = Math.max(audioContext.currentTime + 0.01, state.nextPlayTime);
  source.start(startAt);
  state.nextPlayTime = startAt + buffer.duration;
}

function resetAssistantPlayback() {
  state.nextPlayTime = 0;
}

function findAudioBase64(upstream) {
  if (!upstream || typeof upstream !== "object") {
    return null;
  }
  const queue = [upstream];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }
    if (typeof current.audioBase64 === "string") {
      return current.audioBase64;
    }
    if (typeof current.chunkBase64 === "string") {
      return current.chunkBase64;
    }
    if (current.audio && typeof current.audio === "object") {
      if (typeof current.audio.chunkBase64 === "string") {
        return current.audio.chunkBase64;
      }
      if (typeof current.audio.audioBase64 === "string") {
        return current.audio.audioBase64;
      }
    }
    for (const value of Object.values(current)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }
  return null;
}

function findTextPayload(value) {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  if (typeof value.text === "string") {
    return value.text;
  }
  if (typeof value.transcript === "string") {
    return value.transcript;
  }
  if (typeof value.message === "string") {
    return value.message;
  }
  for (const nested of Object.values(value)) {
    const found = findTextPayload(nested);
    if (found) {
      return found;
    }
  }
  return null;
}

function getApiErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }
  if (payload.error && typeof payload.error === "object") {
    if (typeof payload.error.message === "string" && payload.error.message.trim().length > 0) {
      return payload.error.message;
    }
  }
  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return payload.message;
  }
  return fallback;
}

function handleLiveOutput(upstream) {
  const audioBase64 = findAudioBase64(upstream);
  if (audioBase64) {
    try {
      playPcm16Chunk(decodeBase64ToInt16(audioBase64));
    } catch (error) {
      appendTranscript("error", `Audio decode failed: ${String(error)}`);
    }
  }
  const text = findTextPayload(upstream);
  if (text) {
    appendTranscript("assistant", text);
    updateOfferFromText(text, false);
    evaluateConstraints();
  }
}

function handleNormalizedLiveOutput(normalized) {
  if (!normalized || typeof normalized !== "object") {
    return;
  }
  if (typeof normalized.audioBase64 === "string") {
    try {
      playPcm16Chunk(decodeBase64ToInt16(normalized.audioBase64));
    } catch (error) {
      appendTranscript("error", `Audio decode failed: ${String(error)}`);
    }
  }
  if (typeof normalized.text === "string") {
    appendTranscript("assistant", normalized.text);
    updateOfferFromText(normalized.text, false);
    evaluateConstraints();
  }
  if (normalized.interrupted === true) {
    resetAssistantPlayback();
    appendTranscript("system", "Assistant interrupted (normalized signal)");
  }
}

async function submitApprovalDecision(decision) {
  if (!state.pendingApproval || !state.pendingApproval.approvalId) {
    appendTranscript("error", "No pending approval to process");
    return;
  }

  const apiBaseUrl = normalizeApiBaseUrl(el.apiBaseUrl.value);
  state.apiBaseUrl = apiBaseUrl;
  el.apiBaseUrl.value = apiBaseUrl;

  const reason = el.approvalReason.value.trim();
  const fallbackReason =
    decision === "approved" ? "Approved from demo frontend" : "Rejected from demo frontend";

  setApprovalStatus("submitting", "neutral");

  try {
    const response = await fetch(`${apiBaseUrl}/v1/approvals/resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        approvalId: state.pendingApproval.approvalId,
        userId: state.userId,
        sessionId: state.sessionId,
        runId: state.runId ?? makeId(),
        intent: state.pendingApproval.intent ?? "ui_task",
        decision,
        reason: reason.length > 0 ? reason : fallbackReason,
        input: state.pendingApproval.input ?? {},
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const errorText = getApiErrorMessage(payload, `Approval request failed with status ${response.status}`);
      throw new Error(String(errorText));
    }

    const approval = payload?.data?.approval;
    const approvalDecision = approval?.decision ?? decision;
    appendTranscript(
      "system",
      `Approval ${state.pendingApproval.approvalId} recorded with decision=${approvalDecision}`,
    );

    if (payload?.data?.orchestrator) {
      handleGatewayEvent(payload.data.orchestrator);
    }

    if (approvalDecision === "approved") {
      setApprovalStatus("approved", "ok");
    } else {
      setApprovalStatus("rejected", "fail");
    }

    if (decision === "approved" || approvalDecision === "rejected") {
      clearPendingApproval({ keepStatus: true });
    }
  } catch (error) {
    setApprovalStatus("error", "fail");
    appendTranscript("error", `Approval submit failed: ${String(error)}`);
  }
}

function handleGatewayEvent(event) {
  if (!event || typeof event !== "object") {
    return;
  }

  if (typeof event.userId === "string" && event.userId.trim().length > 0) {
    state.userId = event.userId;
    el.currentUserId.textContent = event.userId;
    el.userId.value = event.userId;
  }

  if (typeof event.runId === "string") {
    state.runId = event.runId;
    el.runId.textContent = event.runId;
  }

  appendEvent(event.type ?? "event", JSON.stringify(event.payload ?? {}, null, 0));

  if (event.type === "gateway.connected") {
    setSessionState("socket_connected");
    appendTranscript("system", "Gateway connected");
    return;
  }

  if (event.type === "session.state") {
    const nextState =
      event.payload && typeof event.payload.state === "string" ? event.payload.state : "unknown";
    const previousState =
      event.payload && typeof event.payload.previousState === "string"
        ? event.payload.previousState
        : null;
    setSessionState(nextState);
    appendTranscript(
      "system",
      previousState ? `Session state: ${previousState} -> ${nextState}` : `Session state: ${nextState}`,
    );
    return;
  }

  if (event.type === "live.bridge.unavailable") {
    setMode("text-fallback");
    appendTranscript("system", "Live bridge unavailable. Switched to text fallback.");
    return;
  }

  if (event.type === "live.bridge.chunk_dropped") {
    const modality = event.payload?.modality ?? "unknown";
    const ageMs = event.payload?.ageMs;
    appendTranscript("system", `Dropped stale ${String(modality)} chunk (age ${formatMs(ageMs)})`);
    return;
  }

  if (event.type === "live.metrics.round_trip") {
    appendTranscript("system", `Live round-trip: ${formatMs(event.payload?.roundTripMs)}`);
    return;
  }

  if (event.type === "live.metrics.interrupt_latency") {
    appendTranscript("system", `Interrupt latency: ${formatMs(event.payload?.interruptLatencyMs)}`);
    return;
  }

  if (event.type === "live.turn.completed") {
    const textChars = event.payload?.textChars;
    appendTranscript("system", `Assistant turn completed (${typeof textChars === "number" ? textChars : 0} chars)`);
    return;
  }

  if (event.type === "live.interrupted") {
    resetAssistantPlayback();
    appendTranscript("system", "Assistant output interrupted");
    return;
  }

  if (event.type === "live.output") {
    if (event.payload?.normalized) {
      handleNormalizedLiveOutput(event.payload.normalized);
      return;
    }
    handleLiveOutput(event.payload?.upstream);
    return;
  }

  if (event.type === "orchestrator.response") {
    const output = event.payload?.output;
    if (event.payload?.task) {
      const task = normalizeTaskRecord(event.payload.task);
      if (task) {
        if (task.status === "completed" || task.status === "failed") {
          removeTaskRecord(task.taskId);
        } else {
          upsertTaskRecord(task);
        }
      }
    }
    if (typeof output?.fallbackAsset === "boolean") {
      setFallbackAsset(output.fallbackAsset);
    }
    if (output?.approvalRequired === true && output?.approvalId) {
      appendTranscript("system", `Approval required: ${output.approvalId}`);
      const resumeTemplate =
        output?.resumeRequestTemplate &&
        typeof output.resumeRequestTemplate === "object" &&
        output.resumeRequestTemplate !== null
          ? output.resumeRequestTemplate
          : {};
      setPendingApproval({
        approvalId: output.approvalId,
        intent: resumeTemplate.intent ?? "ui_task",
        input: resumeTemplate.input ?? {},
      });
    } else if (output?.approval && output.approval.decision === "approved") {
      setApprovalStatus("approved", "ok");
      clearPendingApproval({ keepStatus: true });
    } else if (output?.approval && output.approval.decision === "rejected") {
      setApprovalStatus("rejected", "fail");
      clearPendingApproval({ keepStatus: true });
    }
    if (output?.story?.title) {
      appendTranscript("system", `Story title: ${output.story.title}`);
    }
    if (Array.isArray(output?.story?.timeline)) {
      appendTranscript("system", `Story timeline segments: ${output.story.timeline.length}`);
    }
    if (Array.isArray(output?.mediaJobs?.video) && output.mediaJobs.video.length > 0) {
      const pending = output.mediaJobs.video.filter(
        (job) => job && typeof job === "object" && (job.status === "queued" || job.status === "running"),
      ).length;
      appendTranscript(
        "system",
        `Story video jobs: ${output.mediaJobs.video.length} total, ${pending} pending`,
      );
    }
    if (output?.delegation?.delegatedRoute) {
      appendTranscript(
        "system",
        `Delegated to ${output.delegation.delegatedRoute} (${output.delegation.delegatedStatus ?? "unknown"})`,
      );
      const delegatedText = findTextPayload(output.delegation.delegatedOutput);
      if (delegatedText) {
        appendTranscript("assistant", delegatedText);
      }
    }
    if (output?.visualTesting && typeof output.visualTesting === "object" && output.visualTesting.enabled === true) {
      const checksCount = Array.isArray(output.visualTesting.checks) ? output.visualTesting.checks.length : 0;
      const regressionCount =
        typeof output.visualTesting.regressionCount === "number" ? output.visualTesting.regressionCount : 0;
      appendTranscript(
        "system",
        `Visual testing: ${output.visualTesting.status ?? "unknown"} (checks=${checksCount}, regressions=${regressionCount})`,
      );
      if (Array.isArray(output.visualTesting.checks)) {
        const regressions = output.visualTesting.checks
          .filter((check) => check && typeof check === "object" && check.status === "regression")
          .slice(0, 3);
        for (const check of regressions) {
          const severity = typeof check.severity === "string" ? check.severity : "n/a";
          const category = typeof check.category === "string" ? check.category : "unknown";
          const assertion = typeof check.assertion === "string" ? check.assertion : "unspecified assertion";
          appendTranscript("system", `Regression [${severity}] ${category}: ${assertion}`);
        }
      }
    }

    const text = findTextPayload(output) ?? "orchestrator.response received";
    appendTranscript("assistant", text);
    updateOfferFromText(text, false);
    if (event.payload?.status === "completed") {
      updateOfferFromText(text, true);
    }
    evaluateConstraints();
    return;
  }

  if (event.type === "task.started" || event.type === "task.progress") {
    upsertTaskRecord(event.payload);
    const task = normalizeTaskRecord(event.payload);
    if (task) {
      appendTranscript(
        "system",
        `Task ${task.taskId}: ${task.status} (${task.progressPct}%, stage=${task.stage})`,
      );
    }
    return;
  }

  if (event.type === "task.completed" || event.type === "task.failed") {
    const task = normalizeTaskRecord(event.payload);
    if (task) {
      removeTaskRecord(task.taskId);
      appendTranscript("system", `Task ${task.taskId}: ${task.status}`);
    }
    return;
  }

  if (event.type === "gateway.error" || event.type === "orchestrator.error") {
    appendTranscript("error", findTextPayload(event.payload) ?? "Gateway/Orchestrator error");
  }
}

function connectWebSocket() {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    return;
  }
  const wsUrl = el.wsUrl.value.trim();
  state.wsUrl = wsUrl;
  const ws = new WebSocket(wsUrl);
  state.ws = ws;

  setConnectionStatus("connecting");

  ws.addEventListener("open", () => {
    setConnectionStatus("connected");
    appendTranscript("system", `Connected to ${wsUrl}`);
  });

  ws.addEventListener("close", () => {
    setConnectionStatus("disconnected");
    appendTranscript("system", "WebSocket closed");
    state.ws = null;
  });

  ws.addEventListener("error", () => {
    setConnectionStatus("error");
    appendTranscript("error", "WebSocket error");
  });

  ws.addEventListener("message", (raw) => {
    try {
      const parsed = JSON.parse(raw.data);
      handleGatewayEvent(parsed);
    } catch {
      appendTranscript("error", "Received non-JSON frame from gateway");
    }
  });
}

function disconnectWebSocket() {
  if (!state.ws) {
    return;
  }
  state.ws.close();
}

function downsampleTo16k(input, inputRate) {
  if (inputRate === 16000) {
    return input;
  }
  const ratio = inputRate / 16000;
  const outputLength = Math.floor(input.length / ratio);
  const result = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = Math.floor(i * ratio);
    result[i] = input[sourceIndex];
  }
  return result;
}

function float32ToInt16(floatArray) {
  const out = new Int16Array(floatArray.length);
  for (let i = 0; i < floatArray.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floatArray[i]));
    out[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return out;
}

function int16ToBase64(buffer) {
  const bytes = new Uint8Array(buffer.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function startMicStream() {
  if (state.micProcessor) {
    return;
  }

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    appendTranscript("error", "Connect WebSocket before starting mic stream");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micContext = new AudioContext();
    const source = micContext.createMediaStreamSource(stream);
    const processor = micContext.createScriptProcessor(4096, 1, 1);
    const gain = micContext.createGain();
    gain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleTo16k(channel, micContext.sampleRate);
      const pcm16 = float32ToInt16(downsampled);
      const chunkBase64 = int16ToBase64(pcm16);
      sendEnvelope("live.audio", {
        format: "pcm16",
        sampleRate: 16000,
        chunkBase64,
        sentAtMs: Date.now(),
      });
    };

    source.connect(processor);
    processor.connect(gain);
    gain.connect(micContext.destination);

    state.micContext = micContext;
    state.micStream = stream;
    state.micProcessor = processor;
    state.micGain = gain;

    appendTranscript("system", "Mic stream started");
  } catch (error) {
    appendTranscript("error", `Mic start failed: ${String(error)}`);
  }
}

function stopMicStream() {
  const hadActiveMic = Boolean(state.micProcessor);
  if (state.micProcessor) {
    state.micProcessor.disconnect();
    state.micProcessor.onaudioprocess = null;
    state.micProcessor = null;
  }
  if (state.micGain) {
    state.micGain.disconnect();
    state.micGain = null;
  }
  if (state.micStream) {
    for (const track of state.micStream.getTracks()) {
      track.stop();
    }
    state.micStream = null;
  }
  if (state.micContext) {
    state.micContext.close();
    state.micContext = null;
  }
  if (hadActiveMic) {
    sendEnvelope("live.turn.end", {
      reason: "mic_stopped",
      sentAtMs: Date.now(),
    });
  }
  appendTranscript("system", "Mic stream stopped");
}

function sendIntentRequest() {
  const intent = el.intent.value;
  const message = el.message.value.trim();
  const targetLanguage = el.targetLanguage.value.trim();
  const targetPrice = getNumeric(el.targetPrice);
  const targetDelivery = getNumeric(el.targetDelivery);
  const targetSla = getNumeric(el.targetSla);

  const input = {
    text: message,
    targetLanguage,
    constraints: {
      maxPrice: targetPrice,
      maxDeliveryDays: targetDelivery,
      minSla: targetSla,
    },
  };

  appendTranscript("user", message);
  updateOfferFromText(message, false);
  evaluateConstraints();

  const requestRunId = makeId();
  state.runId = requestRunId;
  el.runId.textContent = requestRunId;

  sendEnvelope("orchestrator.request", { intent, input }, "frontend", requestRunId);
}

function interruptAssistant() {
  resetAssistantPlayback();
  sendEnvelope("live.interrupt", { reason: "user_interrupt" });
  appendTranscript("system", "Interrupt requested");
}

function toggleFallbackMode() {
  if (state.mode === "voice") {
    setMode("text-fallback");
    appendTranscript("system", "Switched to text fallback mode");
  } else {
    setMode("voice");
    appendTranscript("system", "Switched to voice mode");
  }
}

function bindEvents() {
  document.getElementById("connectBtn").addEventListener("click", connectWebSocket);
  document.getElementById("disconnectBtn").addEventListener("click", disconnectWebSocket);
  document.getElementById("startMicBtn").addEventListener("click", startMicStream);
  document.getElementById("stopMicBtn").addEventListener("click", stopMicStream);
  document.getElementById("sendBtn").addEventListener("click", sendIntentRequest);
  document.getElementById("approveResumeBtn").addEventListener("click", () => {
    submitApprovalDecision("approved");
  });
  document.getElementById("rejectResumeBtn").addEventListener("click", () => {
    submitApprovalDecision("rejected");
  });
  document.getElementById("interruptBtn").addEventListener("click", interruptAssistant);
  document.getElementById("fallbackBtn").addEventListener("click", toggleFallbackMode);
  document.getElementById("refreshTasksBtn").addEventListener("click", refreshActiveTasks);
  document.getElementById("operatorRefreshBtn").addEventListener("click", refreshOperatorSummary);
  document.getElementById("operatorCancelBtn").addEventListener("click", () => {
    const taskId = el.operatorTaskId.value.trim();
    if (!taskId) {
      appendTranscript("error", "Operator taskId is required for cancel");
      return;
    }
    runOperatorAction("cancel_task", { taskId, reason: "Cancelled from operator console" });
  });
  document.getElementById("operatorRetryBtn").addEventListener("click", () => {
    const taskId = el.operatorTaskId.value.trim();
    if (!taskId) {
      appendTranscript("error", "Operator taskId is required for retry");
      return;
    }
    runOperatorAction("retry_task", { taskId, reason: "Retry requested from operator console" });
  });
  document.getElementById("operatorDrainBtn").addEventListener("click", () => {
    const targetService = el.operatorTargetService.value;
    runOperatorAction("failover", {
      targetService,
      operation: "drain",
      reason: "Drain requested from operator console",
    });
  });
  document.getElementById("operatorWarmupBtn").addEventListener("click", () => {
    const targetService = el.operatorTargetService.value;
    runOperatorAction("failover", {
      targetService,
      operation: "warmup",
      reason: "Warmup requested from operator console",
    });
  });
  document.getElementById("deviceNodeRefreshBtn").addEventListener("click", () => {
    refreshDeviceNodes();
  });
  document.getElementById("deviceNodeUpsertBtn").addEventListener("click", () => {
    upsertDeviceNodeFromForm();
  });
  document.getElementById("deviceNodeHeartbeatBtn").addEventListener("click", () => {
    sendDeviceNodeHeartbeatFromForm();
  });
  document.getElementById("deviceNodeStatusBtn").addEventListener("click", () => {
    fetchDeviceNodeStatusFromForm();
  });
  document.getElementById("newSessionBtn").addEventListener("click", () => {
    state.sessionId = makeId();
    el.sessionId.value = state.sessionId;
    state.runId = null;
    el.runId.textContent = "-";
    setSessionState("-");
    clearPendingApproval();
    state.taskRecords.clear();
    renderTaskList();
    appendTranscript("system", "Generated new session ID");
  });
  el.userId.addEventListener("input", () => {
    state.userId = el.userId.value.trim() || "demo-user";
    el.userId.value = state.userId;
    el.currentUserId.textContent = state.userId;
  });
  el.sessionId.addEventListener("input", () => {
    state.sessionId = el.sessionId.value.trim() || makeId();
    el.sessionId.value = state.sessionId;
  });
  el.apiBaseUrl.addEventListener("input", () => {
    state.apiBaseUrl = normalizeApiBaseUrl(el.apiBaseUrl.value);
  });
  el.deviceNodeId.addEventListener("change", () => {
    const nodeId = toOptionalText(el.deviceNodeId.value);
    if (!nodeId) {
      return;
    }
    const node = state.deviceNodes.get(nodeId.toLowerCase());
    if (node) {
      applyDeviceNodeToForm(node);
    }
  });
  [el.targetPrice, el.targetDelivery, el.targetSla].forEach((input) => {
    input.addEventListener("input", evaluateConstraints);
  });
}

function bootstrap() {
  state.apiBaseUrl = normalizeApiBaseUrl(el.apiBaseUrl.value);
  el.apiBaseUrl.value = state.apiBaseUrl;
  state.userId = "demo-user";
  el.userId.value = state.userId;
  el.currentUserId.textContent = state.userId;
  state.sessionId = makeId();
  el.sessionId.value = state.sessionId;
  setSessionState("-");
  setStatusPill(el.constraintStatus, "Waiting for offer", "neutral");
  setFallbackAsset(false);
  clearPendingApproval();
  resetOperatorHealthWidget("no_data");
  renderTaskList();
  evaluateConstraints();
  bindEvents();
  refreshOperatorSummary().catch(() => {
    appendTranscript("error", "Initial operator summary fetch failed");
  });
  refreshDeviceNodes({ silent: true }).catch(() => {
    appendTranscript("error", "Initial device node registry fetch failed");
  });
  appendTranscript("system", "Frontend ready");
}

bootstrap();

