import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

const runtimeTypes = await readFile(
  resolve(root, "packages/shared/src/types/capability-runtime.ts"),
  "utf8",
);
const persistence = await readFile(
  resolve(root, "packages/server/src/services/capability-packages/capability-persistence.service.ts"),
  "utf8",
);

assert.match(
  runtimeTypes,
  /interface CapabilityTrackedCharacterRecord[\s\S]*customFields\?: Record<string, unknown>/,
);
assert.match(
  runtimeTypes,
  /interface CapabilityLorebookCreateInput[\s\S]*characterId\?: string;[\s\S]*characterIds\?: string\[\]/,
);
assert.match(
  runtimeTypes,
  /interface CapabilityLorebookUpdateInput[\s\S]*characterId\?: string;[\s\S]*characterIds\?: string\[\]/,
);
assert.match(
  persistence,
  /record\.customFields[\s\S]*customFields: record\.customFields as Record<string, unknown>/,
);

console.info("Capability Character/Lore contract regression passed.");
