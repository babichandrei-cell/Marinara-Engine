import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const generateRoute = readFileSync(resolve(root, "packages/server/src/routes/generate.routes.ts"), "utf8");

assert.match(
  generateRoute,
  /CHARACTER_LORE_REGISTRY_IDS_V1/u,
  "generation route must contain deterministic lore-registry character activation",
);
assert.match(
  generateRoute,
  /registryLoreEntries = await lorebooksStore\.listActiveEntries/u,
  "registry activation must inspect entries only from Lorebooks already relevant to the request",
);
assert.match(
  generateRoute,
  /candidate\.constant === true && characterFilterIds\.length === 0/u,
  "only unfiltered constant entries may act as deterministic identity registries",
);
assert.match(
  generateRoute,
  /for \(const row of await chars\.list\(\)\)/u,
  "registry identities must resolve against existing Character Cards without an LLM",
);
assert.match(
  generateRoute,
  /registryLoreText\.includes\(name\.toLocaleLowerCase\(\)\)/u,
  "registry activation must require an exact Character Card name string in registry lore text",
);
assert.match(
  generateRoute,
  /new Set\(\[\.\.\.promptCharacterIds, \.\.\.trackerCarryForwardCharacterIds, \.\.\.registryCharacterIds\]\)/u,
  "registry IDs must join only the effective lorebook character-filter scope",
);

const registryBlockStart = generateRoute.indexOf("// CHARACTER_LORE_REGISTRY_IDS_V1");
const registryBlockEnd = generateRoute.indexOf("// ── Compute chat embedding for semantic lorebook matching", registryBlockStart);
assert.ok(registryBlockStart >= 0 && registryBlockEnd > registryBlockStart, "registry activation block must precede lore assembly");
const registryBlock = generateRoute.slice(registryBlockStart, registryBlockEnd);
// Match executable statements only; explanatory comments may name forbidden downstream structures.
assert.doesNotMatch(
  registryBlock,
  /(?:^|\n)\s*(?:agentContext\.characters|presentCharacters\s*=|_activeCharacterCardIds)\b/u,
  "registry activation must not assert scene presence or add Character Cards to downstream agent roster",
);
assert.match(
  generateRoute,
  /\[character-lore-registry\] Lore-only activated/u,
  "runtime must expose a diagnostic log for lore-only registry activation",
);

console.log("character-lore-registry-activation regression checks passed");
