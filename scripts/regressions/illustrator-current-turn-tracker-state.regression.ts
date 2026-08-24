import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const generateRoute = readFileSync(resolve(root, "packages/server/src/routes/generate.routes.ts"), "utf8");
const agentExecutor = readFileSync(resolve(root, "packages/server/src/services/agents/agent-executor.ts"), "utf8");
const agentPipeline = readFileSync(resolve(root, "packages/server/src/services/agents/agent-pipeline.ts"), "utf8");

assert.match(
  generateRoute,
  /agentTypeFilter: \(agentType\) => agentType === "character-tracker"/u,
  "Character Tracker must run in its own current-turn stage when Illustrator is active",
);
assert.match(
  generateRoute,
  /agentTypeFilter: \(agentType\) => agentType !== "character-tracker" && agentType !== "illustrator"/u,
  "unrelated post-processing agents must retain their parallel stage",
);
assert.match(
  generateRoute,
  /_currentTurnCharacterTrackerUpdate: currentTurnCharacterTrackerUpdate\.presentCharacters/u,
  "the fresh Tracker result must be passed directly to Illustrator context",
);
assert.match(
  generateRoute,
  /agentTypeFilter: \(agentType\) => agentType === "illustrator"/u,
  "Illustrator must run only after its fresh Tracker overlay is available",
);
assert.match(
  agentExecutor,
  /<current_turn_character_tracker_update>/u,
  "Illustrator prompts must render the dedicated fresh Tracker block",
);
assert.match(
  agentExecutor,
  /newer than the game-state and Lorebook context above/u,
  "the prompt must establish that current-turn Tracker data takes precedence",
);
assert.match(
  agentPipeline,
  /agentTypeFilter\?: \(agentType: string\) => boolean/u,
  "the pipeline must support the targeted post-processing stages without another Tracker call",
);

console.info("Illustrator current-turn Character Tracker state regression passed.");
