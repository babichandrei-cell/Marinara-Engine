import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pipeline = readFileSync(
  resolve(root, "packages/server/src/services/agents/agent-pipeline.ts"),
  "utf8",
);

assert.match(
  pipeline,
  /ILLUSTRATOR_CURRENT_TURN_AGENT_TYPES = new Set\(\["world-state", "custom-tracker", "character-tracker"\]\)/u,
  "Illustrator current-turn dependencies must cover World State, Custom Tracker, and Character Tracker",
);
assert.match(
  pipeline,
  /currentTurnTrackerUpdates: overlay/u,
  "fresh tracker outputs must be exposed to Illustrator through request-local agent results",
);
assert.match(
  pipeline,
  /newer than saved agent outputs and persisted game-state context/u,
  "the overlay must explicitly establish current-turn tracker precedence",
);
assert.match(
  pipeline,
  /targetsIllustrator && targetsCurrentTurnAgents/u,
  "a combined post-processing pass must stage current-turn trackers before Illustrator",
);
assert.match(
  pipeline,
  /ILLUSTRATOR_CURRENT_TURN_AGENT_TYPES\.has\(agentType\)[\s\S]*agentType !== "illustrator"[\s\S]*const illustratorContext = withIllustratorCurrentTurnAgentResults/u,
  "tracker and non-Illustrator work must settle before the Illustrator context is assembled",
);
assert.match(
  pipeline,
  /const fullContext = targetsIllustrator[\s\S]*withIllustratorCurrentTurnAgentResults\(basePostContext, allResults\)/u,
  "a separately staged Illustrator call must still receive tracker results collected by earlier calls",
);

console.info("Illustrator current-turn World State / Custom Tracker / Character Tracker regression passed.");
