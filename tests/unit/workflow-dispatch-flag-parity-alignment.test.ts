import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("workflow/release/railway dispatch scripts keep shared gateway flag parity", () => {
  const workflowSource = readFileSync(resolve(process.cwd(), "scripts", "workflow-dispatch.ps1"), "utf8");
  const releaseSource = readFileSync(resolve(process.cwd(), "scripts", "release-strict-dispatch.ps1"), "utf8");
  const railwaySource = readFileSync(resolve(process.cwd(), "scripts", "railway-deploy-all-dispatch.ps1"), "utf8");

  const sharedSwitchDeclarations = [
    /\[switch\]\$SkipGatewayDeploy/,
    /\[switch\]\$SkipFrontendDeploy/,
    /\[switch\]\$GatewaySkipRootDescriptorCheck/,
    /\[switch\]\$GatewayNoWait/,
    /\[switch\]\$FrontendNoWait/,
    /\[switch\]\$FrontendSkipHealthCheck/,
    /\[switch\]\$NoWaitForRun/,
  ];

  for (const token of sharedSwitchDeclarations) {
    assert.match(workflowSource, token);
    assert.match(releaseSource, token);
    assert.match(railwaySource, token);
  }

  const sharedStringDeclarations = [/\[string\]\$GatewayDemoFrontendPublicUrl = \$env:DEMO_FRONTEND_PUBLIC_URL/];
  for (const token of sharedStringDeclarations) {
    assert.match(workflowSource, token);
    assert.match(releaseSource, token);
    assert.match(railwaySource, token);
  }

  assert.match(
    workflowSource,
    /if \(\$GatewaySkipRootDescriptorCheck\)\s*\{\s*\$dispatchArgs \+= "-GatewaySkipRootDescriptorCheck"/,
  );
  assert.match(releaseSource, /gateway_skip_root_descriptor_check=/);
  assert.match(railwaySource, /gateway_skip_root_descriptor_check=/);
  assert.match(
    workflowSource,
    /if \(-not \[string\]::IsNullOrWhiteSpace\(\$GatewayDemoFrontendPublicUrl\)\)\s*\{\s*\$dispatchArgs \+= @\("-GatewayDemoFrontendPublicUrl", \$GatewayDemoFrontendPublicUrl\)/,
  );
  assert.match(releaseSource, /gateway_demo_frontend_public_url=/);
  assert.match(railwaySource, /gateway_demo_frontend_public_url=/);
});
