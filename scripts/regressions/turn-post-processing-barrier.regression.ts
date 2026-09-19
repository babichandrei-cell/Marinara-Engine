import assert from "node:assert/strict";
import {
  beginTurnPostProcessing,
  isTurnPostProcessingPending,
  waitForTurnPostProcessing,
} from "../../packages/server/src/services/generation/turn-post-processing-barrier.js";

const chatId = "turn-post-processing-barrier-regression";
const releaseFirstTurn = beginTurnPostProcessing(chatId);
assert.equal(isTurnPostProcessingPending(chatId), true, "a running turn must hold the storyboard barrier");

const waitForFirstTurn = waitForTurnPostProcessing(chatId, new AbortController().signal, 1);
let firstWaitFinished = false;
void waitForFirstTurn.then(() => {
  firstWaitFinished = true;
});
await new Promise((resolve) => setTimeout(resolve, 5));
assert.equal(firstWaitFinished, false, "Storyboard must not start while tracker persistence is pending");
releaseFirstTurn();
await waitForFirstTurn;
assert.equal(isTurnPostProcessingPending(chatId), false, "releasing the turn must unblock Storyboard");

const releaseOlderTurn = beginTurnPostProcessing(chatId);
const releaseNewerTurn = beginTurnPostProcessing(chatId);
releaseOlderTurn();
assert.equal(
  isTurnPostProcessingPending(chatId),
  true,
  "an older generation must not clear a newer turn's completion barrier",
);
releaseNewerTurn();
assert.equal(isTurnPostProcessingPending(chatId), false);
