import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("demo frontend package builds the app shell before compiling the server", () => {
  const packagePath = resolve(process.cwd(), "apps", "demo-frontend", "package.json");
  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(pkg.scripts?.prebuild, "npm run build:app-shell");
  assert.equal(pkg.scripts?.["build:app-shell"], "vite build -c vite.app-shell.config.ts");
  assert.equal(pkg.scripts?.predev, "npm run build:app-shell");
  assert.equal(pkg.scripts?.["dev:app-shell"], "vite -c vite.app-shell.config.ts");
});

test("demo frontend server redirects root to /app and keeps legacy on /legacy", () => {
  const serverPath = resolve(process.cwd(), "apps", "demo-frontend", "src", "server.ts");
  const source = readFileSync(serverPath, "utf8");

  assert.match(source, /const appShellDir = path\.resolve\(publicDir, "app-shell"\);/);
  assert.match(source, /const legacyIndexPath = path\.resolve\(publicDir, "index\.html"\);/);
  assert.match(source, /const appShellIndexPath = path\.resolve\(appShellDir, "index\.html"\);/);
  assert.match(source, /function isAppShellDocumentRoute\(urlPath: string\): boolean/);
  assert.match(source, /function isAppShellAssetRoute\(urlPath: string\): boolean/);
  assert.match(source, /req\.method === "GET" && \(req\.url === "\/" \|\| req\.url\?\.startsWith\("\/\?"\)\)/);
  assert.match(source, /res\.setHeader\("Location", `\/app\$\{query\}`\);/);
  assert.match(source, /requestPath === "\/legacy" \|\| requestPath === "\/legacy\/"/);
  assert.match(source, /filePath = appShellIndexPath;/);
  assert.match(source, /filePath = legacyIndexPath;/);
});

test("built app shell publishes stable public assets for /app, /bundle, and /evidence routes", () => {
  const htmlPath = resolve(process.cwd(), "apps", "demo-frontend", "public", "app-shell", "index.html");
  const html = readFileSync(htmlPath, "utf8");

  assert.ok(existsSync(htmlPath));
  assert.match(html, /\/app-shell\/style\.css/);
  assert.match(html, /\/app-shell\/index\.js/);
});

test("app shell tailwind config resolves content globs from the config directory", () => {
  const configPath = resolve(process.cwd(), "apps", "demo-frontend", "app-shell", "tailwind.config.ts");
  const source = readFileSync(configPath, "utf8");

  assert.match(source, /import path from "node:path";/);
  assert.match(source, /import \{ fileURLToPath \} from "node:url";/);
  assert.match(source, /const configDir = path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/);
  assert.match(source, /const fromConfigDir = \(target: string\) => path\.resolve\(configDir, target\)\.replaceAll\("\\\\", "\/"\);/);
  assert.match(source, /content: \[fromConfigDir\("index\.html"\), fromConfigDir\("src\/\*\*\/\*\.\{js,jsx,ts,tsx\}"\)\],/);
});
