import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("operator console exposes bootstrap doctor and auth-profile control surfaces", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "index.html");
  const appPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app.js");
  const stylesPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "styles.css");
  const readmePath = resolve(process.cwd(), "README.md");
  const operatorGuidePath = resolve(process.cwd(), "docs", "operator-guide.md");

  const htmlSource = readFileSync(htmlPath, "utf8");
  const appSource = readFileSync(appPath, "utf8");
  const stylesSource = readFileSync(stylesPath, "utf8");
  const readmeSource = readFileSync(readmePath, "utf8");
  const operatorGuideSource = readFileSync(operatorGuidePath, "utf8");

  const requiredHtmlTokens = [
    '<details id="operatorBootstrapDoctorControl" class="operator-bootstrap-doctor-control operator-support-panel"',
    "Bootstrap Doctor &amp; Auth Profiles",
    'id="operatorBootstrapDoctorControlStatus"',
    'id="operatorBootstrapDoctorControlMeta"',
    'id="operatorBootstrapDoctorProfileId"',
    'id="operatorBootstrapDoctorCredentialName"',
    'id="operatorBootstrapDoctorReason"',
    'id="operatorBootstrapDoctorRefreshBtn"',
    'id="operatorBootstrapDoctorRotateBtn"',
    'id="operatorBootstrapDoctorCurrentConfig"',
    'id="operatorBootstrapDoctorLastResult"',
    "<h3>Bootstrap Doctor</h3>",
    'id="operatorBootstrapDoctorStatus"',
    'id="operatorBootstrapDoctorProviders"',
    'id="operatorBootstrapDoctorAuthProfiles"',
    'id="operatorBootstrapDoctorDeviceReadiness"',
    'id="operatorBootstrapDoctorFallbackPaths"',
    'id="operatorBootstrapDoctorTopCheck"',
    'id="operatorBootstrapDoctorHint"',
  ];
  for (const token of requiredHtmlTokens) {
    assert.ok(htmlSource.includes(token), `frontend html missing bootstrap-doctor token: ${token}`);
  }

  const requiredRuntimeTokens = [
    "operatorBootstrapDoctorSnapshot: null",
    "operatorBootstrapDoctorLoadedAt: null",
    "operatorBootstrapDoctorLastResult: null",
    'operatorBootstrapDoctorControl: document.getElementById("operatorBootstrapDoctorControl")',
    'operatorBootstrapDoctorControlStatus: document.getElementById("operatorBootstrapDoctorControlStatus")',
    'operatorBootstrapDoctorProfileId: document.getElementById("operatorBootstrapDoctorProfileId")',
    'operatorBootstrapDoctorCredentialName: document.getElementById("operatorBootstrapDoctorCredentialName")',
    'operatorBootstrapDoctorRefreshBtn: document.getElementById("operatorBootstrapDoctorRefreshBtn")',
    'operatorBootstrapDoctorRotateBtn: document.getElementById("operatorBootstrapDoctorRotateBtn")',
    'operatorBootstrapDoctorStatus: document.getElementById("operatorBootstrapDoctorStatus")',
    "function renderOperatorBootstrapDoctorWidget(bootstrapDoctorSummary)",
    "function setOperatorBootstrapDoctorControlStatus(text, variant = \"neutral\")",
    "function renderOperatorBootstrapDoctorControlPanel()",
    "async function refreshOperatorBootstrapDoctor(options = {})",
    "async function rotateOperatorBootstrapAuthProfile()",
    'fetch(`${state.apiBaseUrl}/v1/runtime/bootstrap-status`',
    'fetch(`${state.apiBaseUrl}/v1/runtime/auth-profiles`',
    'fetch(`${state.apiBaseUrl}/v1/runtime/auth-profiles/rotate`',
    "bootstrap_doctor",
    "bootstrap_doctor.top_check",
    "resetOperatorBootstrapDoctorWidget(failedRefreshReason);",
    "renderOperatorBootstrapDoctorControlPanel();",
    "refreshOperatorBootstrapDoctor({ silent: true }).catch(() => {",
    "el.operatorBootstrapDoctorRefreshBtn.addEventListener(\"click\", () => {",
    "el.operatorBootstrapDoctorRotateBtn.addEventListener(\"click\", () => {",
  ];
  for (const token of requiredRuntimeTokens) {
    assert.ok(appSource.includes(token), `frontend runtime missing bootstrap-doctor token: ${token}`);
  }

  const requiredStyleTokens = [
    ".operator-bootstrap-doctor-control {",
    ".operator-bootstrap-doctor-control-body {",
    ".operator-bootstrap-doctor-control-grid {",
    ".operator-bootstrap-doctor-control-actions > button {",
    ".operator-bootstrap-doctor-control-output-grid {",
    ".operator-bootstrap-doctor-control-output-card {",
    ".operator-bootstrap-doctor-control-output {",
  ];
  for (const token of requiredStyleTokens) {
    assert.ok(stylesSource.includes(token), `frontend styles missing bootstrap-doctor token: ${token}`);
  }

  assert.ok(readmeSource.includes("`Bootstrap Doctor & Auth Profiles`"), "README missing bootstrap doctor panel note");
  assert.ok(readmeSource.includes("`Bootstrap Doctor` card"), "README missing bootstrap doctor widget note");
  assert.ok(operatorGuideSource.includes("`Bootstrap Doctor & Auth Profiles`"), "operator guide missing bootstrap doctor panel note");
  assert.ok(operatorGuideSource.includes("`Bootstrap Doctor`"), "operator guide missing bootstrap doctor widget note");
});
