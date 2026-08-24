import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const generateRoute = readFileSync(resolve(root, "packages/server/src/routes/generate.routes.ts"), "utf8");
const agentExecutor = readFileSync(resolve(root, "packages/server/src/services/agents/agent-executor.ts"), "utf8");
const promptIndex = readFileSync(resolve(root, "packages/server/src/services/prompt/index.ts"), "utf8");

assert.match(
  promptIndex,
  /buildReferencedCharacterContext/u,
  "prompt service must export buildReferencedCharacterContext for request-scoped carry-forward",
);

assert.match(
  generateRoute,
  /CHARACTER_LORE_CARRY_FORWARD_V1/u,
  "generation route must contain the deterministic Character Lore carry-forward block",
);
assert.equal(
  (generateRoute.match(/CHARACTER_LORE_CARRY_FORWARD_V1/gu) ?? []).length,
  1,
  "generation route must contain exactly one carry-forward block",
);

const carryForwardMarkerIndex = generateRoute.indexOf("// CHARACTER_LORE_CARRY_FORWARD_V1");
const optionalPreGenGateIndex = generateRoute.indexOf(
  "if (shouldRunDirectorSecretPlot || shouldRunPreGen || shouldRunKR || shouldRunRouter)",
);
assert.ok(carryForwardMarkerIndex >= 0, "carry-forward marker must exist");
assert.ok(optionalPreGenGateIndex >= 0, "optional pre-generation gate must exist");
assert.ok(
  carryForwardMarkerIndex < optionalPreGenGateIndex,
  "carry-forward must execute independently of the optional pre-generation/KR/Router gate",
);

assert.match(
  generateRoute,
  /Array\.isArray\(gameState\?\.presentCharacters\)/u,
  "carry-forward must be sourced from the anchored prior Character Tracker presentCharacters state",
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
  /buildReferencedCharacterContext\(\{/u,
  "carried Character Cards must use Marinara's referenced-character context builder so attached Character Lore is included",
);
assert.match(
  generateRoute,
  /agentContext\.memory\._activatedCharacterContext = carriedContext\.content/u,
  "the same carried character context must be saved for downstream agents",
);
assert.match(
  generateRoute,
  /finalMessages = injectAtDepth\(finalMessages/u,
  "carried Character Card/Lore context must reach the main model",
);

assert.match(
  agentExecutor,
  /agentTypes\.includes\("character-tracker"\)/u,
  "Character Tracker must consume the carried canonical character context",
);
assert.match(
  agentExecutor,
  /context\.memory\._activatedCharacterContext/u,
  "Character Tracker must receive the same card/lore context as the main model",
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
