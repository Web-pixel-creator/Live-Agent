import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("railway config-as-code pins production-safe start command for realtime gateway", () => {
  const railwayConfigPath = resolve(process.cwd(), "railway.json");
  const railwayConfigRaw = readFileSync(railwayConfigPath, "utf8");
  const railwayConfig = JSON.parse(railwayConfigRaw) as {
    deploy?: {
      startCommand?: string;
    };
  };

  assert.equal(
    railwayConfig.deploy?.startCommand,
    "node --import tsx apps/realtime-gateway/src/index.ts",
    "railway.json deploy.startCommand must run gateway runtime via tsx loader",
  );
});

test("realtime-gateway package keeps build script required by railway start command", () => {
  const gatewayPackagePath = resolve(process.cwd(), "apps", "realtime-gateway", "package.json");
  const gatewayPackageRaw = readFileSync(gatewayPackagePath, "utf8");
  const gatewayPackage = JSON.parse(gatewayPackageRaw) as {
    scripts?: Record<string, string>;
  };

  assert.match(gatewayPackage.scripts?.build ?? "", /tsc -p tsconfig\.json/);
  assert.match(gatewayPackage.scripts?.dev ?? "", /tsx src\/index\.ts/);
});
