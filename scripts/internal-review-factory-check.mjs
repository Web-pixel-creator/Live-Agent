import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const cwd = process.cwd();
const requiredFiles = [
  "docs/internal-review-factory/README.md",
  "docs/internal-review-factory/product-rethink.prompt.md",
  "docs/internal-review-factory/engineering-review.prompt.md",
  "docs/internal-review-factory/qa-review.prompt.md",
  "docs/internal-review-factory/release-doc-update.prompt.md",
  "docs/worker-roles.md",
];

const promptFiles = requiredFiles.filter((file) => file.endsWith(".prompt.md"));
const requiredPromptHeadings = [
  "# ",
  "## Purpose",
  "## When To Use",
  "## Prompt",
  "## Inputs",
  "## Output",
  "## Checklist",
];

async function readText(relativePath) {
  const absolutePath = resolve(cwd, relativePath);
  return readFile(absolutePath, "utf8");
}

function assert(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

const failures = [];

for (const relativePath of requiredFiles) {
  try {
    await readText(relativePath);
  } catch (error) {
    failures.push(`Missing required file: ${relativePath}`);
  }
}

try {
  const workerRoles = await readText("docs/worker-roles.md");
  assert(
    workerRoles.includes("Internal Review Factory Lead"),
    "docs/worker-roles.md does not register the Internal Review Factory Lead role.",
    failures,
  );
  assert(
    workerRoles.includes("docs/internal-review-factory/"),
    "docs/worker-roles.md does not point to the internal review factory docs folder.",
    failures,
  );
} catch {
  failures.push("Unable to read docs/worker-roles.md.");
}

for (const relativePath of promptFiles) {
  try {
    const content = await readText(relativePath);
    for (const heading of requiredPromptHeadings) {
      assert(
        content.includes(heading),
        `${relativePath} is missing required heading: ${heading}`,
        failures,
      );
    }
  } catch {
    failures.push(`Unable to read prompt file: ${relativePath}`);
  }
}

try {
  const readme = await readText("docs/internal-review-factory/README.md");
  assert(
    readme.includes("product-rethink.prompt.md") &&
      readme.includes("engineering-review.prompt.md") &&
      readme.includes("qa-review.prompt.md") &&
      readme.includes("release-doc-update.prompt.md"),
    "docs/internal-review-factory/README.md does not reference all prompt files.",
    failures,
  );
  assert(
    readme.includes("node scripts/internal-review-factory-check.mjs"),
    "docs/internal-review-factory/README.md does not document the validation script.",
    failures,
  );
} catch {
  failures.push("Unable to read docs/internal-review-factory/README.md.");
}

if (failures.length > 0) {
  console.error("[internal-review-factory-check] failed");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        ok: true,
        filesChecked: requiredFiles.length,
        promptFilesChecked: promptFiles.length,
      },
      null,
      2,
    ),
  );
}
