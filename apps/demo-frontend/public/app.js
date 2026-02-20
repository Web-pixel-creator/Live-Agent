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
      const errorText = payload?.error ?? `tasks/active failed with ${response.status}`;
      throw new Error(String(errorText));
    }
    const records = Array.isArray(payload?.data) ? payload.data : [];
    state.taskRecords.clear();
    for (const item of records) {
      upsertTaskRecord(item);
    }
    renderTaskList();
    appendTranscript("system", `Active tasks refreshed: ${records.length}`);
  } catch (error) {
    appendTranscript("error", `Active tasks refresh failed: ${String(error)}`);
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
      const errorText =
        payload?.error ?? payload?.message ?? `Approval request failed with status ${response.status}`;
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
  renderTaskList();
  evaluateConstraints();
  bindEvents();
  appendTranscript("system", "Frontend ready");
}

bootstrap();

