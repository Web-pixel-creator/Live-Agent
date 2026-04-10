import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { Script, createContext } from "node:vm";

type FocusResult = {
  kind: "proof" | "question";
  id: string;
  item: Record<string, unknown>;
};

type Harness = {
  __buildSnapshot: (snapshot: unknown) => Record<string, unknown> | null;
  __resolveEvidencePack: (snapshot: unknown) => Record<string, unknown> | null;
  __resolvePreferredWorkspaceFocus: (
    snapshot: unknown,
    evidencePack: unknown,
    preferredKind?: "proof" | "question" | null,
  ) => FocusResult | null;
  __setFocus: (focus: unknown) => void;
};

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) {
    assert.fail(`app.js missing function ${name}`);
  }
  const open = source.indexOf("{", start);
  if (open === -1) {
    assert.fail(`app.js function ${name} has no body`);
  }
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  assert.fail(`app.js function ${name} has an unterminated body`);
}

function createHarness(): Harness {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const helperSource = [
    "buildOperatorCaseWikiSnapshot",
    "resolveOperatorCaseWikiTopProof",
    "resolveOperatorCaseWikiTopBlockingQuestion",
    "resolveOperatorCaseWikiEvidencePack",
    "normalizeOperatorCaseWikiFocus",
    "resolveOperatorCaseWikiFocusedItem",
    "resolveOperatorCaseWikiPreferredWorkspaceFocus",
  ].map((name) => extractFunction(appSource, name)).join("\n\n");
  const context = createContext({});
  new Script(`
    const state = { operatorCaseWikiFocus: null };
    function isRecord(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }
    function toOptionalText(value) {
      return typeof value === "string" && value.trim() ? value.trim() : null;
    }
    ${helperSource}
    globalThis.__buildSnapshot = (snapshot) => buildOperatorCaseWikiSnapshot(snapshot);
    globalThis.__resolveEvidencePack = (snapshot) => resolveOperatorCaseWikiEvidencePack(snapshot);
    globalThis.__resolvePreferredWorkspaceFocus = (snapshot, evidencePack, preferredKind = null) =>
      resolveOperatorCaseWikiPreferredWorkspaceFocus(snapshot, evidencePack, preferredKind);
    globalThis.__setFocus = (focus) => {
      state.operatorCaseWikiFocus = focus;
    };
  `).runInContext(context);
  return context as unknown as Harness;
}

function buildDefaultFocus(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    focusKind: "question",
    focusId: "question-default",
    focusLabel: "Backend default question",
    chipTitle: "Default question chip",
    focusSummary: "Backend default question",
    drilldown: "Default question drilldown",
    handoffPreview: "Default question handoff",
    source: "focusPack",
    ...overrides,
  };
}

function buildRawSnapshot(defaultFocus: Record<string, unknown> | null = buildDefaultFocus()): Record<string, unknown> {
  return {
    schemaVersion: 1,
    caseId: "case-focus-1",
    sessionId: "session-focus-1",
    generatedAt: "2026-04-10T05:00:00.000Z",
    overview: null,
    highlights: {
      topProof: {
        id: "proof-highlight",
        statement: "Highlighted proof",
        status: "missing",
      },
      topBlockingQuestion: {
        id: "question-highlight",
        question: "Highlighted question",
        blocking: true,
      },
    },
    evidencePack: {
      proofs: [
        { id: "proof-default", statement: "Default proof" },
        { id: "proof-highlight", statement: "Highlighted proof", status: "missing" },
        { id: "proof-explicit", statement: "Explicit proof" },
      ],
      entities: [],
      questions: [
        { id: "question-default", question: "Backend default question" },
        { id: "question-highlight", question: "Highlighted question", blocking: true },
        { id: "question-explicit", question: "Explicit question" },
      ],
      sourceRefs: ["workflow:focus"],
    },
    focusPack: {
      proofs: [
        {
          focusKind: "proof",
          focusId: "proof-default",
          focusLabel: "Default proof",
          chipTitle: "Default proof chip",
          focusSummary: "Default proof",
          drilldown: "Default proof drilldown",
          handoffPreview: "Default proof handoff",
        },
      ],
      questions: [
        {
          focusKind: "question",
          focusId: "question-default",
          focusLabel: "Backend default question",
          chipTitle: "Default question chip",
          focusSummary: "Backend default question",
          drilldown: "Default question drilldown",
          handoffPreview: "Default question handoff",
        },
      ],
    },
    workspacePack: {
      defaultFocus,
      statusValue: "Waiting on customer",
      summaryValue: "Case summary",
      blockerValue: "Blocking question",
      nextActionValue: "Ask for the missing evidence",
      proofTitle: "Top proof",
      proofSummary: "Proof summary",
      entityTitle: null,
      entitySummary: null,
      packValue: "3 proofs",
      refsValue: "workflow:focus",
      questionsValue: "2 questions",
      timelineValue: "1 event",
      drilldownValue: "Workspace drilldown",
      handoffValue: "Workspace handoff",
    },
    proofs: [],
    entities: [],
    openQuestions: [],
    timeline: [],
    recommendedNextAction: null,
  };
}

test("case wiki workspace focus keeps backend default focus through frontend snapshot normalization", () => {
  const harness = createHarness();
  const snapshot = harness.__buildSnapshot(buildRawSnapshot());
  const normalizedDefaultFocus = (snapshot?.workspacePack as Record<string, unknown>)?.defaultFocus as Record<
    string,
    unknown
  >;

  assert.equal(normalizedDefaultFocus.focusKind, "question");
  assert.equal(normalizedDefaultFocus.focusId, "question-default");
  assert.equal(normalizedDefaultFocus.focusLabel, "Backend default question");
  assert.equal(normalizedDefaultFocus.chipTitle, "Default question chip");
  assert.equal(normalizedDefaultFocus.focusSummary, "Backend default question");
  assert.equal(normalizedDefaultFocus.drilldown, "Default question drilldown");
  assert.equal(normalizedDefaultFocus.handoffPreview, "Default question handoff");
  assert.equal(normalizedDefaultFocus.source, "focusPack");

  const evidencePack = harness.__resolveEvidencePack(snapshot);
  harness.__setFocus(null);

  const defaultFocus = harness.__resolvePreferredWorkspaceFocus(snapshot, evidencePack);
  assert.equal(defaultFocus?.kind, "question");
  assert.equal(defaultFocus?.id, "question-default");
  assert.equal(defaultFocus?.item.question, "Backend default question");

  const proofFocus = harness.__resolvePreferredWorkspaceFocus(snapshot, evidencePack, "proof");
  assert.equal(proofFocus?.kind, "proof");
  assert.equal(proofFocus?.id, "proof-highlight");
  assert.equal(proofFocus?.item.statement, "Highlighted proof");

  harness.__setFocus({ kind: "proof", id: "proof-explicit" });
  const explicitFocus = harness.__resolvePreferredWorkspaceFocus(snapshot, evidencePack);
  assert.equal(explicitFocus?.kind, "proof");
  assert.equal(explicitFocus?.id, "proof-explicit");
  assert.equal(explicitFocus?.item.statement, "Explicit proof");
});

test("case wiki workspace focus falls back when backend default focus is stale", () => {
  const harness = createHarness();
  const snapshot = harness.__buildSnapshot(buildRawSnapshot(buildDefaultFocus({ focusId: "question-missing" })));
  const evidencePack = harness.__resolveEvidencePack(snapshot);

  harness.__setFocus(null);

  const focus = harness.__resolvePreferredWorkspaceFocus(snapshot, evidencePack);
  assert.equal(focus?.kind, "question");
  assert.equal(focus?.id, "question-highlight");
  assert.equal(focus?.item.question, "Highlighted question");
});
