import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo surface keeps AI Action Desk framing across docs and frontend copy", () => {
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");

  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");
  const appSource = readFileSync(appPath, "utf8");

  const requiredReadmeTokens = [
    "# AI Action Desk",
    "qualify inbound leads",
    "book consultations or appointments",
    "collect documents and form data safely",
    "`Simulation Lab` for scenario rehearsal, story timelines, and multimodal training flows",
  ];
  for (const token of requiredReadmeTokens) {
    assert.ok(readmeSource.includes(token), `README missing product narrative token: ${token}`);
  }

  const requiredOperatorGuideTokens = [
    "`Live Negotiator` should be treated as the main `AI Action Desk` surface.",
    "lead qualification, consultation booking, and document collection",
    "`Storyteller` should be read as a `Simulation Lab` or training surface",
  ];
  for (const token of requiredOperatorGuideTokens) {
    assert.ok(operatorGuideSource.includes(token), `operator guide missing product narrative token: ${token}`);
  }

  const requiredAppTokens = [
    '"hero.title": "AI Action Desk"',
    '"hero.subtitle": "One workspace for lead qualification, booking, document collection, and safe follow-through."',
    '"tabs.storyteller": "Simulation Lab"',
    '"live.compose.heading": "AI Action Desk"',
    '"storyteller.heading": "Simulation Lab"',
    '"live.support.runStory": "Run Lab"',
    '"storyteller.labels.title": "Scenario Title"',
    'live: "Qualify, book, collect docs."',
    'story: "Rehearsals and scenarios."',
    'operator: "Approvals and runtime."',
    'title: isRu ? "\\u0416\\u0438\\u0432\\u043e\\u0439 \\u0434\\u0438\\u0430\\u043b\\u043e\\u0433" : "Qualify, book, collect"',
    'eyebrow: isRu ? "\\u0410\\u043a\\u0442\\u0438\\u0432\\u043d\\u0430\\u044f \\u0437\\u043e\\u043d\\u0430" : "AI Action Desk"',
    'Run objections, training drills, and media cues from one shared brief.',
  ];
  for (const token of requiredAppTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing AI Action Desk token: ${token}`);
  }

  const removedAppTokens = [
    'live: "Chat, translate, negotiate."',
    'story: "Scenes and timeline."',
    'operator: "Runtime and recovery."',
    '"live.support.runStory": "Run Story"',
    '"storyteller.labels.title": "Story Title"',
    '"Quick actions up top, registration first, fleet overview second, advanced checks below."',
    '"Studio is ready for the first run"',
  ];
  for (const token of removedAppTokens) {
    assert.ok(!appSource.includes(token), `frontend runtime still contains retired narrative token: ${token}`);
  }
});
