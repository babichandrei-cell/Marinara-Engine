import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-capability-character-lore-behavior-"));
process.env.DATA_DIR = dataDir;

try {
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { gameStateSnapshots } = await import("../../packages/server/src/db/schema/index.js");
  const { createCapabilityPersistenceHost } = await import(
    "../../packages/server/src/services/capability-packages/capability-persistence.service.js"
  );
  const { createCapabilityResourceHost } = await import(
    "../../packages/server/src/services/capability-packages/capability-resources.service.js"
  );

  const db = await getDB();
  const persistence = createCapabilityPersistenceHost(db);
  const resources = createCapabilityResourceHost(db);

  // ── Character Tracker customFields survive the authoritative anchor read. ──
  const trackerState = [
    {
      characterId: "NPC_Eleanor_Marlowe",
      name: "Mrs. Eleanor Marlowe",
      emoji: "😟",
      mood: "despairing",
      appearance: "Middle-aged woman with a pale complexion.",
      outfit: "Formal dark day dress; black gloves removed.",
      thoughts: "I should have listened to her.",
      customFields: {
        ClientStatus: "Seeking information about missing daughter",
        CasePriority: 3,
        ConfirmedWitness: false,
      },
      stats: [{ name: "Nervousness", value: 98, max: 100, color: "#FF0000" }],
    },
  ];

  await db.insert(gameStateSnapshots).values({
    id: "snapshot-character-lore-behavior",
    chatId: "chat-character-lore-behavior",
    messageId: "message-character-lore-behavior",
    swipeIndex: 2,
    presentCharacters: JSON.stringify(trackerState),
    worldCustomFields: "[]",
    recentEvents: "[]",
    committed: 0,
    createdAt: "2026-08-21T13:00:00.000Z",
  });

  assert.equal(
    typeof persistence.getCharacterTrackerState,
    "function",
    "Capability API 1.14 must expose anchored Character Tracker reads",
  );

  const tracked = await persistence.getCharacterTrackerState!(
    "chat-character-lore-behavior",
    "message-character-lore-behavior",
    2,
  );

  assert.equal(tracked.length, 1);
  assert.equal(tracked[0]?.characterId, "NPC_Eleanor_Marlowe");
  assert.deepEqual(
    tracked[0]?.customFields,
    {
      ClientStatus: "Seeking information about missing daughter",
      CasePriority: 3,
      ConfirmedWitness: false,
    },
    "Structured Character Tracker customFields must survive the capability anchor read",
  );

  // ── Character ownership passes through the Capability Lorebook API. ──
  assert.equal(typeof resources.createLorebook, "function");
  assert.equal(typeof resources.updateLorebook, "function");

  const created = await resources.createLorebook!({
    name: "Eva Green — Dynamic Character State",
    description: "Capability ownership regression fixture.",
    category: "character",
    characterId: "character-eva",
    enabled: true,
  });

  let [createdReadback] = await resources.listLorebooks([created.id]);
  assert.ok(createdReadback, "Created lorebook must be readable through CapabilityResourceHost");

  let createdData = createdReadback.data as Record<string, unknown>;
  assert.equal(createdData.characterId, "character-eva");
  assert.deepEqual(
    createdData.characterIds,
    ["character-eva"],
    "createLorebook(characterId) must create the Character ownership link",
  );

  await resources.updateLorebook!(created.id, {
    characterIds: ["character-eva", "character-anya"],
  });

  [createdReadback] = await resources.listLorebooks([created.id]);
  assert.ok(createdReadback);

  createdData = createdReadback.data as Record<string, unknown>;
  assert.deepEqual(
    new Set(createdData.characterIds as string[]),
    new Set(["character-eva", "character-anya"]),
    "updateLorebook(characterIds) must replace Character ownership links",
  );

  await resources.updateLorebook!(created.id, {
    characterId: "character-milla",
  });

  [createdReadback] = await resources.listLorebooks([created.id]);
  assert.ok(createdReadback);

  createdData = createdReadback.data as Record<string, unknown>;
  assert.equal(createdData.characterId, "character-milla");
  assert.deepEqual(
    createdData.characterIds,
    ["character-milla"],
    "updateLorebook(characterId) must replace multi-Character ownership with the requested Character",
  );

  await closeDB();
  console.info("Capability Character/Lore behavioral regression passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
