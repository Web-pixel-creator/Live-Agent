import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchRuntimeApi,
  resolveRuntimeApiUrl,
} from "../../apps/demo-frontend/app-shell/src/lib/runtime-api.ts";

test("resolveRuntimeApiUrl prefers configured frontend api base when present", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | RequestInfo) => {
    calls.push(String(input));
    return new Response(
      JSON.stringify({
        runtime: {
          apiBaseUrl: "http://localhost:8081/",
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }) as typeof fetch;

  const resolved = await resolveRuntimeApiUrl("/v1/operator/summary", fetchImpl);

  assert.equal(resolved, "http://localhost:8081/v1/operator/summary");
  assert.deepEqual(calls, ["/config.json"]);
});

test("fetchRuntimeApi falls back to same-origin route when runtime config is unavailable", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | RequestInfo) => {
    const url = String(input);
    calls.push(url);
    if (url === "/config.json") {
      return new Response("missing", {
        status: 404,
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as typeof fetch;

  const response = await fetchRuntimeApi(
    "/v1/device-nodes?includeOffline=true&limit=200",
    {
      headers: {
        "x-operator-role": "viewer",
      },
    },
    fetchImpl,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [
    "/config.json",
    "/v1/device-nodes?includeOffline=true&limit=200",
  ]);
});
