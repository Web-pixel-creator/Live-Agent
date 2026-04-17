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
    "handoffPack",
    "detailPack",
    "routingPack",
    "actionPack",
    "remediationDraft",
    "focusPack",
    "previewPack",
    "workspacePack",
    "defaultFocus",
    "buildCaseWikiDefaultFocus",
    "operatorPreviewPack",
    "remediation:",
    "compliance",
    "enforcement",
    "auditLog",
    "buildAuditLog",
    "buildCaseWikiComplianceEnforcement",
    "buildEventSourceRefs",
    "questionsValue",
    "timelineValue",
    "questions:",
    "timeline:",
    "audit:",
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
  assert.match(readme, /handoffPack/i);
  assert.match(readme, /detailPack/i);
  assert.match(readme, /routingPack/i);
  assert.match(readme, /actionPack/i);
  assert.match(readme, /remediationDraft/i);
  assert.match(readme, /focusPack/i);
  assert.match(readme, /previewPack/i);
  assert.match(readme, /workspacePack/i);
  assert.match(readme, /defaultFocus/i);
  assert.match(readme, /open-question/i);
  assert.match(readme, /operatorPreviewPack/i);
  assert.match(readme, /Focused Remediation/i);
  assert.match(readme, /compliance/i);
  assert.match(readme, /auditLog/i);
  assert.match(readme, /Open Questions/i);
  assert.match(readme, /Timeline/i);
  assert.match(readme, /Audit/i);
  assert.match(readme, /Compliance/i);
  assert.match(readme, /enforcement/i);
  assert.match(operatorGuide, /case wiki/i);
  assert.match(operatorGuide, /case-wiki\/notes/i);
  assert.match(operatorGuide, /handoffPack/i);
  assert.match(operatorGuide, /detailPack/i);
  assert.match(operatorGuide, /routingPack/i);
  assert.match(operatorGuide, /actionPack/i);
  assert.match(operatorGuide, /remediationDraft/i);
  assert.match(operatorGuide, /focusPack/i);
  assert.match(operatorGuide, /previewPack/i);
  assert.match(operatorGuide, /workspacePack/i);
  assert.match(operatorGuide, /defaultFocus/i);
  assert.match(operatorGuide, /timeline/i);
  assert.match(operatorGuide, /operatorPreviewPack/i);
  assert.match(operatorGuide, /Focused Remediation/i);
  assert.match(operatorGuide, /compliance/i);
  assert.match(operatorGuide, /auditLog/i);
  assert.match(operatorGuide, /Open Questions/i);
  assert.match(operatorGuide, /Timeline/i);
  assert.match(operatorGuide, /Audit/i);
  assert.match(operatorGuide, /Compliance/i);
  assert.match(operatorGuide, /enforcement/i);
  assert.match(architecture, /case wiki/i);
  assert.match(architecture, /handoffPack/i);
  assert.match(architecture, /detailPack/i);
  assert.match(architecture, /routingPack/i);
  assert.match(architecture, /actionPack/i);
  assert.match(architecture, /remediationDraft/i);
  assert.match(architecture, /focusPack/i);
  assert.match(architecture, /previewPack/i);
  assert.match(architecture, /workspacePack/i);
  assert.match(architecture, /defaultFocus/i);
  assert.match(architecture, /timeline/i);
  assert.match(architecture, /operatorPreviewPack/i);
  assert.match(architecture, /Focused Remediation/i);
  assert.match(architecture, /compliance/i);
  assert.match(architecture, /auditLog/i);
  assert.match(architecture, /Open Questions/i);
  assert.match(architecture, /Timeline/i);
  assert.match(architecture, /Audit/i);
  assert.match(architecture, /Compliance/i);
  assert.match(architecture, /enforcement/i);
  assert.match(architecture, /case-wiki\/notes/i);
});
