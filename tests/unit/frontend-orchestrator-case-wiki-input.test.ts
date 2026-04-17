import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { Script, createContext } from "node:vm";

type Harness = {
  __setState: (nextState: Record<string, unknown>) => void;
  __buildInput: (input: Record<string, unknown> | null) => Record<string, unknown>;
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
    "resolveCaseWikiSnapshotFromInput",
    "resolveCaseWikiSnapshotForInput",
    "buildOrchestratorInput",
  ]
    .map((name) => extractFunction(appSource, name))
    .join("\n\n");
  const context = createContext({});
  new Script(`
    const state = { operatorCaseWikiSnapshot: null, sessionId: null };
    function isRecord(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }
    function toOptionalText(value) {
      return typeof value === "string" && value.trim() ? value.trim() : null;
    }
    ${helperSource}
    globalThis.__setState = (nextState) => {
      Object.assign(state, nextState);
    };
    globalThis.__buildInput = (input) => buildOrchestratorInput(input);
  `).runInContext(context);
  return context as unknown as Harness;
}

test("buildOrchestratorInput preserves matching case wiki aliases", () => {
  const harness = createHarness();
  harness.__setState({
    sessionId: "session-123",
    operatorCaseWikiSnapshot: {
      sessionId: "session-123",
      overview: {
        summary: "operator snapshot",
      },
    },
  });

  const input = {
    compiledCaseWiki: {
      sessionId: "session-123",
      overview: {
        summary: "caller snapshot",
      },
    },
    draft: "help",
  };

  const result = harness.__buildInput(input);
  assert.deepEqual(result, input);
  assert.equal("caseWiki" in result, false);
});

test("buildOrchestratorInput injects the current-session case wiki when alias input is stale", () => {
  const harness = createHarness();
  harness.__setState({
    sessionId: "session-123",
    operatorCaseWikiSnapshot: {
      sessionId: "session-123",
      overview: {
        summary: "fresh operator snapshot",
      },
    },
  });

  const result = harness.__buildInput({
    context: {
      caseWiki: {
        sessionId: "session-stale",
        overview: {
          summary: "stale caller snapshot",
        },
      },
    },
  });

  assert.deepEqual(result.caseWiki, {
    sessionId: "session-123",
    overview: {
      summary: "fresh operator snapshot",
    },
  });
  assert.deepEqual(result.context, {
    caseWiki: {
      sessionId: "session-stale",
      overview: {
        summary: "stale caller snapshot",
      },
    },
  });
});
