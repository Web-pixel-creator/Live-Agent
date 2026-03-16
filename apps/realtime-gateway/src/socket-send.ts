import WebSocket from "ws";

export type WebSocketLike = {
  readyState: number;
  send(data: string): void;
};

export type SendWsJsonResult =
  | {
      sent: true;
      reason: null;
      error: null;
    }
  | {
      sent: false;
      reason: "socket_not_open" | "send_failed";
      error: string | null;
    };

export function sendWsJson(ws: WebSocketLike, payload: unknown): SendWsJsonResult {
  if (ws.readyState !== WebSocket.OPEN) {
    return {
      sent: false,
      reason: "socket_not_open",
      error: null,
    };
  }

  try {
    ws.send(JSON.stringify(payload));
    return {
      sent: true,
      reason: null,
      error: null,
    };
  } catch (error) {
    return {
      sent: false,
      reason: "send_failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
