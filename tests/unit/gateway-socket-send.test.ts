import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { sendWsJson, type WebSocketLike } from "../../apps/realtime-gateway/src/socket-send.js";

test("sendWsJson skips closed sockets without throwing", () => {
  let sendCalled = false;
  const ws: WebSocketLike = {
    readyState: WebSocket.CLOSED,
    send() {
      sendCalled = true;
      throw new Error("send should not run for closed sockets");
    },
  };

  const result = sendWsJson(ws, { ok: true });

  assert.deepEqual(result, {
    sent: false,
    reason: "socket_not_open",
    error: null,
  });
  assert.equal(sendCalled, false);
});

test("sendWsJson captures synchronous send failures", () => {
  const ws: WebSocketLike = {
    readyState: WebSocket.OPEN,
    send() {
      throw new Error("socket write failed");
    },
  };

  const result = sendWsJson(ws, { ok: true });

  assert.deepEqual(result, {
    sent: false,
    reason: "send_failed",
    error: "socket write failed",
  });
});

test("sendWsJson serializes payloads for open sockets", () => {
  let sentPayload = "";
  const ws: WebSocketLike = {
    readyState: WebSocket.OPEN,
    send(data: string) {
      sentPayload = data;
    },
  };

  const result = sendWsJson(ws, { type: "gateway.connected", ok: true });

  assert.deepEqual(result, {
    sent: true,
    reason: null,
    error: null,
  });
  assert.equal(sentPayload, JSON.stringify({ type: "gateway.connected", ok: true }));
});
