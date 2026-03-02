import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("observability evidence workflow avoids secrets context in if-conditions", () => {
  const workflowPath = resolve(process.cwd(), ".github", "workflows", "observability-evidence.yml");
  const source = readFileSync(workflowPath, "utf8");

  assert.match(source, /GCP_CREDENTIALS_JSON:\s*\$\{\{\s*secrets\.GCP_CREDENTIALS_JSON\s*\}\}/);
  assert.match(source, /if:\s*\$\{\{\s*env\.GCP_CREDENTIALS_JSON == ''\s*\}\}/);
  assert.match(source, /if:\s*\$\{\{\s*env\.GCP_CREDENTIALS_JSON != ''\s*\}\}/);
  assert.match(source, /credentials_json:\s*\$\{\{\s*env\.GCP_CREDENTIALS_JSON\s*\}\}/);
  assert.doesNotMatch(source, /if:\s*\$\{\{\s*secrets\.GCP_CREDENTIALS_JSON/);
});
