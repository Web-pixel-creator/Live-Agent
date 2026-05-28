import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("app shell nodes page prefers backend-owned device nodes and falls back to design mocks", () => {
  const pagePath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "app-shell",
    "src",
    "pages",
    "Nodes.tsx",
  );
  const source = readFileSync(pagePath, "utf8");
  const helperPath = resolve(
    process.cwd(),
    "apps",
    "demo-frontend",
    "app-shell",
    "src",
    "lib",
    "runtime-device-nodes.ts",
  );
  const helper = readFileSync(helperPath, "utf8");

  assert.match(source, /useQuery\(\{/);
  assert.match(source, /queryKey:\s*\["device-nodes", "app-shell"\]/);
  assert.match(source, /import \{\s*fetchRuntimeDeviceNodes,\s*mapRuntimeDeviceNode,\s*\} from "@\/lib\/runtime-device-nodes";/);
  assert.match(source, /queryFn:\s*fetchRuntimeDeviceNodes,/);
  assert.match(source, /runtimeNodes\.length > 0 \? runtimeNodes : edgeNodes/);
  assert.match(source, /const counts = useMemo\(\(\) => nodeCounts\(sourceNodes\), \[sourceNodes\]\);/);

  assert.match(helper, /import \{ fetchRuntimeApi \} from "@\/lib\/runtime-api";/);
  assert.match(helper, /fetchRuntimeApi\(\s*"\/v1\/device-nodes\?includeOffline=true&limit=200"/);
  assert.match(helper, /"x-operator-role":\s*"viewer"/);
});
