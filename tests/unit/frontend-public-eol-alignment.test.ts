import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("frontend public assets stay LF-normalized for Windows CI alignment tests", () => {
  const attributesPath = resolve(process.cwd(), ".gitattributes");
  const attributes = readFileSync(attributesPath, "utf8");

  assert.match(attributes, /apps\/demo-frontend\/public\/\*\.css text eol=lf/);
  assert.match(attributes, /apps\/demo-frontend\/public\/\*\.html text eol=lf/);
  assert.match(attributes, /apps\/demo-frontend\/public\/\*\.js text eol=lf/);
});
