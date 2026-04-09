import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("api backend exposes runtime case wiki routes, helpers, inventory, and docs", () => {
  const indexSource = readFileSync(resolve(process.cwd(), "apps", "api-backend", "src", "index.ts"), "utf8");
  const builderSource = readFileSync(
    resolve(process.cwd(), "apps", "api-backend", "src", "runtime-case-wiki.ts"),
    "utf8",
  );
  const notesSource = readFileSync(
    resolve(process.cwd(), "apps", "api-backend", "src", "runtime-case-wiki-notes.ts"),
    "utf8",
  );
  const inventorySource = readFileSync(
    resolve(process.cwd(), "apps", "api-backend", "src", "runtime-surface-inventory.ts"),
    "utf8",
  );
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuide = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");
  const architecture = readFileSync(resolve(process.cwd(), "docs", "architecture.md"), "utf8");

  for (const token of [
    "/v1/runtime/case-wiki",
    "/v1/runtime/case-wiki/notes",
    "buildRuntimeCaseWiki",
    "appendRuntimeCaseWikiNote",
    "normalizeRuntimeCaseWikiNoteRequest",
    'source: "repo_owned_runtime_case_wiki"',
    'source: "repo_owned_case_wiki_note_ingest"',
    "API_RUNTIME_CASE_WIKI_NOT_FOUND",
    "API_RUNTIME_CASE_WIKI_NOTE_INVALID_JSON",
    "runtime_case_wiki_note_append",
  ]) {
    assert.ok(indexSource.includes(token), `runtime case wiki API missing token: ${token}`);
  }

  for (const token of [
    "buildRuntimeCaseWiki",
    "CaseWiki",
    "routingPack",
    "question:event:",
    "operator.note",
    "case_wiki_note",
  ]) {
    assert.ok(builderSource.includes(token), `runtime case wiki builder missing token: ${token}`);
  }

  for (const token of [
    "normalizeRuntimeCaseWikiNoteRequest",
    "appendRuntimeCaseWikiNote",
    "API_RUNTIME_CASE_WIKI_NOTE_INVALID_REQUEST",
    "type: \"operator.note\"",
    "kind: \"case_wiki_note\"",
  ]) {
    assert.ok(notesSource.includes(token), `runtime case wiki note helper missing token: ${token}`);
  }

  for (const token of [
    'path: "/v1/runtime/case-wiki"',
    'path: "/v1/runtime/case-wiki/notes"',
    'label: "Case Wiki"',
    'label: "Case Wiki notes"',
  ]) {
    assert.ok(inventorySource.includes(token), `runtime surface inventory missing token: ${token}`);
  }

  assert.match(readme, /GET \/v1\/runtime\/case-wiki/);
  assert.match(readme, /POST \/v1\/runtime\/case-wiki\/notes/);
  assert.match(readme, /case wiki/i);
  assert.match(readme, /routingPack/i);
  assert.match(operatorGuide, /case wiki/i);
  assert.match(operatorGuide, /case-wiki\/notes/i);
  assert.match(operatorGuide, /routingPack/i);
  assert.match(architecture, /case wiki/i);
  assert.match(architecture, /routingPack/i);
  assert.match(architecture, /case-wiki\/notes/i);
});
