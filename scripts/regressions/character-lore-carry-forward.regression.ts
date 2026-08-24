import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const generateRoute = readFileSync(resolve(root, "packages/server/src/routes/generate.routes.ts"), "utf8");
const agentExecutor = readFileSync(resolve(root, "packages/server/src/services/agents/agent-executor.ts"), "utf8");
const promptIndex = readFileSync(resolve(root, "packages/server/src/services/prompt/index.ts"), "utf8");
const assembler = readFileSync(resolve(root, "packages/server/src/services/prompt/assembler.ts"), "utf8");

assert.match(
  promptIndex,
  /buildReferencedCharacterContext/u,
  "prompt service must export buildReferencedCharacterContext for request-scoped carry-forward",
);

assert.match(
  generateRoute,
  /CHARACTER_LORE_EFFECTIVE_IDS_V1/u,
  "generation route must resolve carried canonical IDs before standard lorebook assembly",
);
assert.match(
  generateRoute,
  /trackerCarryForwardSnapshot = await selectedGameStateSnapshotPromise/u,
  "early lore activation must use Marinara's selected committed\/visible game-state snapshot promise",
);
assert.match(
  generateRoute,
  /parseGameStateRow\(trackerCarryForwardSnapshot as Record<string, unknown>\)/u,
  "the selected snapshot must be parsed through the normal game-state parser before reading Tracker characters",
);
assert.doesNotMatch(
  generateRoute.slice(
    generateRoute.indexOf("// CHARACTER_LORE_EFFECTIVE_IDS_V1"),
    generateRoute.indexOf("// ── Compute chat embedding for semantic lorebook matching"),
  ),
  /gameState\?\.presentCharacters/u,
  "early lore activation must not read gameState before its later declaration",
);
assert.equal(
  (generateRoute.match(/const trackerCarryForwardCharacterIds: string\[\] = \[\];/gu) ?? []).length,
  1,
  "canonical Tracker carry-forward IDs must be declared exactly once and reused by lore + card context",
);
assert.match(
  generateRoute,
  /new Set\(\[\.\.\.promptCharacterIds, \.\.\.trackerCarryForwardCharacterIds\]\)/u,
  "standard lore character scope must union prompt roster IDs with canonical Tracker carry-forward IDs",
);
assert.match(
  generateRoute,
  /characterIds: effectiveLorebookCharacterIds/u,
  "semantic lore scope discovery must use the effective request-scoped lore character IDs",
);
assert.match(
  generateRoute,
  /lorebookCharacterIds: effectiveLorebookCharacterIds/u,
  "preset assembler must receive the effective request-scoped lore character IDs separately from roster IDs",
);
assert.match(
  assembler,
  /lorebookCharacterIds\?: string\[\]/u,
  "assembler must expose a lore-only character ID scope",
);
assert.match(
  assembler,
  /characterIds: input\.lorebookCharacterIds \?\? input\.characterIds/u,
  "lore marker matching must use lore-only character IDs while preserving normal roster/card semantics",
);

assert.match(
  generateRoute,
  /CHARACTER_LORE_CARRY_FORWARD_V1/u,
  "generation route must contain the deterministic Character Card carry-forward block",
);
assert.equal(
  (generateRoute.match(/CHARACTER_LORE_CARRY_FORWARD_V1/gu) ?? []).length,
  1,
  "generation route must contain exactly one carry-forward card-context block",
);

const carryForwardMarkerIndex = generateRoute.indexOf("// CHARACTER_LORE_CARRY_FORWARD_V1");
const optionalPreGenGateIndex = generateRoute.indexOf(
  "if (shouldRunDirectorSecretPlot || shouldRunPreGen || shouldRunKR || shouldRunRouter)",
);
const effectiveIdsMarkerIndex = generateRoute.indexOf("// CHARACTER_LORE_EFFECTIVE_IDS_V1");
const embeddingIndex = generateRoute.indexOf("// ── Compute chat embedding for semantic lorebook matching");
assert.ok(effectiveIdsMarkerIndex >= 0, "effective lore character ID marker must exist");
assert.ok(embeddingIndex >= 0, "embedding/lore assembly phase must exist");
assert.ok(
  effectiveIdsMarkerIndex < embeddingIndex,
  "canonical Tracker IDs must be resolved before standard lorebook scope discovery and prompt assembly",
);
assert.ok(carryForwardMarkerIndex >= 0, "carry-forward marker must exist");
assert.ok(optionalPreGenGateIndex >= 0, "optional pre-generation gate must exist");
assert.ok(
  carryForwardMarkerIndex < optionalPreGenGateIndex,
  "carry-forward card context must execute independently of the optional pre-generation/KR/Router gate",
);

assert.match(
  generateRoute,
  /Array\.isArray\(trackerCarryForwardState\?\.presentCharacters\)/u,
  "carry-forward must read presentCharacters from the selected anchored prior Tracker state",
);
assert.match(
  generateRoute,
  /await chars\.getById\(candidateId\)/u,
  "only IDs that resolve to real Character Cards may be carried forward",
);
assert.match(
  generateRoute,
  /loadCharacterPromptInfo\(\{/u,
  "carried Character Cards must use the normal Character Card prompt loader",
);
assert.match(
  generateRoute,
  /activeCharacterIds: effectiveLorebookCharacterIds/u,
  "referenced Character Card context must share the same effective lore character scope",
);
assert.match(
  generateRoute,
  /buildReferencedCharacterContext\(\{/u,
  "carried Character Cards must use Marinara's referenced-character context builder",
);
assert.match(
  generateRoute,
  /agentContext\.memory\._activatedCharacterContext = carriedContext\.content/u,
  "the same carried character context must be saved for downstream agents",
);
assert.match(
  generateRoute,
  /finalMessages = injectAtDepth\(finalMessages/u,
  "carried Character Card context must reach the main model",
);

assert.match(
  agentExecutor,
  /agentTypes\.includes\("character-tracker"\)/u,
  "Character Tracker must consume the carried canonical character context",
);
assert.match(
  agentExecutor,
  /context\.memory\._activatedCharacterContext/u,
  "Character Tracker must receive the same card context as the main model",
);
assert.match(
  agentExecutor,
  /<activated_character_context>/u,
  "Character Tracker carry-forward context must remain explicitly delimited",
);

assert.match(
  generateRoute,
  /_currentTurnCharacterTrackerUpdate/u,
  "Illustrator current-turn Tracker handoff must remain present",
);
assert.match(
  generateRoute,
  /agentTypeFilter: \(agentType\) => agentType === "illustrator"/u,
  "Illustrator must remain in its dedicated final post-processing stage",
);

console.log("character-lore-carry-forward regression checks passed");