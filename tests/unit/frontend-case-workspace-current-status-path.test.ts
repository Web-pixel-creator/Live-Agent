import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("case workspace keeps verified-result status on the live case posture", () => {
  const appSource = readFileSync(resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js"), "utf8");
  const readmeSource = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  const operatorGuideSource = readFileSync(resolve(process.cwd(), "docs", "operator-guide.md"), "utf8");

  for (const token of [
    'case "visa_result":',
    'status: isRu ? "\\u042d\\u0442\\u0430\\u043f \\u0434\\u043e\\u043a\\u0443\\u043c\\u0435\\u043d\\u0442\\u043e\\u0432 \\u0433\\u043e\\u0442\\u043e\\u0432" : "Documents stage is ready"',
    'case "visa_follow_up_result":',
    'status: isRu ? "\\u042d\\u0442\\u0430\\u043f \\u043a\\u043e\\u043d\\u0441\\u0443\\u043b\\u044c\\u0442\\u0430\\u0446\\u0438\\u0438 \\u0433\\u043e\\u0442\\u043e\\u0432" : "Consultation stage is ready"',
    'case "visa_reminder_result":',
    'status: isRu ? "\\u042d\\u0442\\u0430\\u043f CRM \\u0433\\u043e\\u0442\\u043e\\u0432" : "CRM stage is ready"',
    'case "visa_handoff_result":',
    'status: isRu ? "\\u042d\\u0442\\u0430\\u043f \\u043f\\u0435\\u0440\\u0435\\u0434\\u0430\\u0447\\u0438 \\u0433\\u043e\\u0442\\u043e\\u0432" : "Handoff stage is ready"',
    'case "visa_escalation_result":',
    'status: isRu ? "\\u0414\\u0430\\u043b\\u044c\\u0448\\u0435 \\u0432\\u0435\\u0434\\u0451\\u0442 \\u0447\\u0435\\u043b\\u043e\\u0432\\u0435\\u043a" : "Human owner takes over"',
  ]) {
    assert.ok(appSource.includes(token), `app.js missing case-status path token: ${token}`);
  }

  assert.ok(
    readmeSource.includes("after a verified result, `Current case` status now stays on the live case posture"),
    "README should explain that verified-result statuses now describe the live case posture",
  );
  assert.ok(
    operatorGuideSource.includes("after a verified result, `Current case` status now stays on the live case posture"),
    "operator guide should explain that verified-result statuses now describe the live case posture",
  );
});
