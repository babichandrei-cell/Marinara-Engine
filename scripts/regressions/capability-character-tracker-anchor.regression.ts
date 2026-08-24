import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-capability-tracker-anchor-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

let app: {
  close(): Promise<void>;
  ready(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<any>;
} | null = null;

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { getDB } = await import("../../packages/server/src/db/connection.js");
  const { createGameStateStorage } = await import(
    "../../packages/server/src/services/storage/game-state.storage.js"
  );
  const { createCapabilityPersistenceHost } = await import(
    "../../packages/server/src/services/capability-packages/capability-persistence.service.js"
  );

  app = await buildApp();
  await app.ready();

  const db = await getDB();
  const gameState = createGameStateStorage(db);
  const persistence = createCapabilityPersistenceHost(db);

  assert.equal(
    typeof persistence.getCharacterTrackerState,
    "function",
    "Capability API 1.14 must expose anchored Character Tracker reads",
  );

  const chatResponse = await app.inject({
    method: "POST",
    url: "/api/chats",
    payload: {
      name: "Capability tracker anchor regression",
      mode: "roleplay",
      characterIds: [],
    },
  });
  assert.equal(chatResponse.statusCode, 200);
  const chat = chatResponse.json();

  const messageResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/messages`,
    payload: {
      role: "assistant",
      content: "Eva enters the room.",
    },
  });
  assert.equal(messageResponse.statusCode, 200);
  const message = messageResponse.json();

  const baseState = {
    chatId: chat.id,
    messageId: message.id,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    worldCustomFields: [],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    fieldLocks: {},
    hiddenTrackerFields: {},
    committed: true,
  };

  await gameState.create({
    ...baseState,
    swipeIndex: 0,
    presentCharacters: [
      {
        characterId: "eva-green",
        name: "Eva Green",
        emoji: "🕴️",
        mood: "focused",
        appearance: "dark hair",
        outfit: "Black corset dress with lace gloves.",
        thoughts: "First swipe.",
        stats: [],
        avatarPath: "/eva-0.png",
        avatarCrop: null,
      },
    ],
  });

  await gameState.create({
    ...baseState,
    swipeIndex: 1,
    presentCharacters: [
      {
        characterId: "eva-green",
        name: "Eva Green",
        emoji: "🕴️",
        mood: "calm",
        appearance: "dark hair",
        outfit: "White silk blouse with black trousers.",
        thoughts: "Second swipe.",
        stats: [],
        avatarPath: "/eva-1.png",
        avatarCrop: null,
      },
    ],
  });

  const swipe0 = await persistence.getCharacterTrackerState!(
    chat.id,
    message.id,
    0,
  );

  const swipe1 = await persistence.getCharacterTrackerState!(
    chat.id,
    message.id,
    1,
  );

  assert.equal(swipe0.length, 1);
  assert.equal(swipe1.length, 1);

  assert.equal(swipe0[0]?.characterId, "eva-green");
  assert.equal(swipe1[0]?.characterId, "eva-green");

  assert.equal(
    swipe0[0]?.outfit,
    "Black corset dress with lace gloves.",
    "swipe 0 must return its own tracker snapshot",
  );

  assert.equal(
    swipe1[0]?.outfit,
    "White silk blouse with black trousers.",
    "swipe 1 must return its own tracker snapshot",
  );

  assert.equal(swipe0[0]?.mood, "focused");
  assert.equal(swipe1[0]?.mood, "calm");

  assert.equal(swipe0[0]?.avatarPath, "/eva-0.png");
  assert.equal(swipe1[0]?.avatarPath, "/eva-1.png");

  const missingSwipe = await persistence.getCharacterTrackerState!(
    chat.id,
    message.id,
    99,
  );

  assert.deepEqual(
    missingSwipe,
    [],
    "an unknown anchor must not fall back to the latest tracker snapshot",
  );

  console.info("Capability Character Tracker anchor regression passed.");
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}
