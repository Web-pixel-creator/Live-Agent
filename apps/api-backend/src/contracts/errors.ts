import { randomUUID } from "node:crypto";
import type { ApiErrorResponse, NormalizedError } from "./types.js";

function sanitizeMessage(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function createNormalizedError(params: {
  code: string;
  message: string;
  traceId?: string;
  details?: unknown;
}): NormalizedError {
  const traceId = typeof params.traceId === "string" && params.traceId.trim().length > 0
    ? params.traceId.trim()
    : randomUUID();
  const normalized: NormalizedError = {
    code: sanitizeMessage(params.code, "UNKNOWN_ERROR"),
    message: sanitizeMessage(params.message, "Unknown error"),
    traceId,
  };
  if (params.details !== undefined) {
    normalized.details = params.details;
  }
  return normalized;
}

export function normalizeUnknownError(
  error: unknown,
  params: {
    defaultCode: string;
    defaultMessage: string;
    traceId?: string;
    details?: unknown;
  },
): NormalizedError {
  if (typeof error === "object" && error !== null) {
    const maybe = error as {
      code?: unknown;
      message?: unknown;
      traceId?: unknown;
      details?: unknown;
    };
    const code = typeof maybe.code === "string" && maybe.code.trim().length > 0
      ? maybe.code
      : params.defaultCode;
    const message = typeof maybe.message === "string" && maybe.message.trim().length > 0
      ? maybe.message
      : params.defaultMessage;
    const traceId = typeof maybe.traceId === "string" && maybe.traceId.trim().length > 0
      ? maybe.traceId
      : params.traceId;
    const details = maybe.details !== undefined ? maybe.details : params.details;
    return createNormalizedError({
      code,
      message,
      traceId,
      details,
    });
  }

  return createNormalizedError({
    code: params.defaultCode,
    message: params.defaultMessage,
    traceId: params.traceId,
    details: params.details,
  });
}

export function createApiErrorResponse(params: {
  error: NormalizedError;
  service?: string;
  runtime?: unknown;
}): ApiErrorResponse {
  const response: ApiErrorResponse = {
    ok: false,
    error: params.error,
  };
  if (params.service) {
    response.service = params.service;
  }
  if (params.runtime !== undefined) {
    response.runtime = params.runtime;
  }
  return response;
}
