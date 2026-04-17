import assert from "node:assert/strict";
import test from "node:test";
import type { OrchestratorRequest } from "@mla/contracts";
import {
  attachCaseWikiSnapshotToRequest,
  createCaseWikiRequestAttacher,
  fetchRuntimeCaseWikiSnapshot,
  requestHasCaseWikiSnapshot,
} from "../../apps/realtime-gateway/src/case-wiki-client.js";

function createRequest(input: Record<string, unknown>): OrchestratorRequest {
  return {
    id: "evt_req_1",
    type: "orchestrator.request",
    source: "frontend",
    sessionId: "session-123",
    userId: "user-123",
    conversation: "primary",
    payload: {
      intent: "conversation",
      input,
    },
    timestamp: "2026-04-13T10:00:00.000Z",
  };
}

test("fetchRuntimeCaseWikiSnapshot requests case wiki with viewer role and tenant scope", async () => {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const caseWiki = { sessionId: "session-123", focusPack: { summary: "compiled" } };

  const result = await fetchRuntimeCaseWikiSnapshot(
    {
      apiBackendBaseUrl: "http://localhost:8081",
    },
    {
      sessionId: "session-123",
      tenantId: "tenant-42",
      fetchImpl: async (input, init) => {
        calls.push({
          url: String(input),
          headers: new Headers(init?.headers),
        });
        return new Response(JSON.stringify({ data: caseWiki }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
      },
    },
  );

  assert.deepEqual(result, caseWiki);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "http://localhost:8081/v1/runtime/case-wiki?sessionId=session-123");
  assert.equal(calls[0]?.headers.get("x-operator-role"), "viewer");
  assert.equal(calls[0]?.headers.get("x-tenant-id"), "tenant-42");
});

test("fetchRuntimeCaseWikiSnapshot returns null for missing case wiki snapshots", async () => {
  const result = await fetchRuntimeCaseWikiSnapshot(
    {
      apiBackendBaseUrl: "http://localhost:8081",
    },
    {
      sessionId: "session-404",
      fetchImpl: async () => new Response(JSON.stringify({ code: "API_RUNTIME_CASE_WIKI_NOT_FOUND" }), { status: 404 }),
    },
  );

  assert.equal(result, null);
});

test("attachCaseWikiSnapshotToRequest preserves request shape and embeds case wiki into input", () => {
  const request = createRequest({
    draft: "hello",
  });

  const updated = attachCaseWikiSnapshotToRequest(request, {
    sessionId: "session-123",
    focusPack: {
      summary: "compiled",
    },
  });

  assert.notEqual(updated, request);
  assert.deepEqual((updated.payload as { input: Record<string, unknown> }).input.caseWiki, {
    sessionId: "session-123",
    focusPack: {
      summary: "compiled",
    },
  });
  assert.equal((updated.payload as { input: Record<string, unknown> }).input.draft, "hello");
});

test("createCaseWikiRequestAttacher injects fetched case wiki and reuses cache within ttl", async () => {
  let nowMs = 1_000;
  let fetchCount = 0;
  const attacher = createCaseWikiRequestAttacher(
    {
      apiBackendBaseUrl: "http://localhost:8081",
    },
    {
      cacheTtlMs: 100,
      now: () => nowMs,
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response(
          JSON.stringify({
            data: {
              sessionId: "session-123",
              focusPack: {
                summary: "compiled",
              },
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      },
    },
  );

  const request = createRequest({
    tenantId: "tenant-42",
    prompt: "help",
  });

  const first = await attacher(request);
  const second = await attacher(request);
  nowMs += 101;
  const third = await attacher(request);

  assert.equal(fetchCount, 2);
  assert.equal(requestHasCaseWikiSnapshot(first), true);
  assert.equal(requestHasCaseWikiSnapshot(second), true);
  assert.equal(requestHasCaseWikiSnapshot(third), true);
  assert.deepEqual((first.payload as { input: Record<string, unknown> }).input.caseWiki, {
    sessionId: "session-123",
    focusPack: {
      summary: "compiled",
    },
  });
});

test("createCaseWikiRequestAttacher does not overwrite an existing matching snapshot", async () => {
  let fetchCount = 0;
  const attacher = createCaseWikiRequestAttacher(
    {
      apiBackendBaseUrl: "http://localhost:8081",
    },
    {
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response(JSON.stringify({ data: { sessionId: "session-123" } }), { status: 200 });
      },
    },
  );

  const request = createRequest({
    caseWiki: {
      sessionId: "session-123",
      focusPack: {
        summary: "existing",
      },
    },
  });

  const updated = await attacher(request);
  assert.equal(fetchCount, 0);
  assert.equal(updated, request);
});

test("requestHasCaseWikiSnapshot accepts supported alias forms for the current session", () => {
  const request = createRequest({
    context: {
      caseWiki: {
        sessionId: "session-123",
        focusPack: {
          summary: "compiled",
        },
      },
    },
  });

  assert.equal(requestHasCaseWikiSnapshot(request), true);
});

test("createCaseWikiRequestAttacher preserves matching alias snapshots without refetching", async () => {
  let fetchCount = 0;
  const attacher = createCaseWikiRequestAttacher(
    {
      apiBackendBaseUrl: "http://localhost:8081",
    },
    {
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response(JSON.stringify({ data: { sessionId: "session-123" } }), { status: 200 });
      },
    },
  );

  const request = createRequest({
    caseWikiSnapshot: {
      sessionId: "session-123",
      focusPack: {
        summary: "alias",
      },
    },
  });

  const updated = await attacher(request);
  assert.equal(fetchCount, 0);
  assert.equal(updated, request);
});

test("createCaseWikiRequestAttacher replaces stale alias snapshots with the current-session case wiki", async () => {
  let fetchCount = 0;
  const attacher = createCaseWikiRequestAttacher(
    {
      apiBackendBaseUrl: "http://localhost:8081",
    },
    {
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response(
          JSON.stringify({
            data: {
              sessionId: "session-123",
              focusPack: {
                summary: "fresh",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );

  const request = createRequest({
    compiledCaseWiki: {
      sessionId: "session-stale",
      focusPack: {
        summary: "stale",
      },
    },
  });

  const updated = await attacher(request);
  const updatedInput = updated.payload as { input: Record<string, unknown> };

  assert.equal(fetchCount, 1);
  assert.deepEqual(updatedInput.input.caseWiki, {
    sessionId: "session-123",
    focusPack: {
      summary: "fresh",
    },
  });
  assert.deepEqual(updatedInput.input.compiledCaseWiki, {
    sessionId: "session-stale",
    focusPack: {
      summary: "stale",
    },
  });
});
