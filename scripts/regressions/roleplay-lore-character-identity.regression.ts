import assert from "node:assert/strict";

import {
  resolveLoreCharacterIdsFromText,
  resolveLoreCharacterIdsFromTrackerState,
  type CharacterIdentity,
} from "../../packages/server/src/routes/generate/generate-route-utils.ts";

const evaId = "hOOM5_L931hp6VwPgzmzS";
const emmaId = "character-emma";

const library: CharacterIdentity[] = [
  {
    id: evaId,
    name: "Eva Green",
    aliases: ["Eva", "Ева", "Ева Грин"],
  },
  {
    id: emmaId,
    name: "Emma Stone",
    aliases: ["Emma", "Эмма"],
  },
];

const trackerState = {
  presentCharacters: [
    {
      characterId: evaId,
      name: "Eva Green",
    },

    // Same Character duplicated by Tracker state must not duplicate Lore id.
    {
      characterId: evaId,
      name: "Eva Green",
    },

    // NPC-like identity must never become Character-linked Lore scope.
    {
      characterId: "Mrs. Eleanor Marlowe",
      name: "Mrs. Eleanor Marlowe",
    },

    // Explicit NPC id must also be ignored.
    {
      characterId: "NPC_Thomas_Wren",
      name: "Thomas Wren",
    },

    // Unknown/stale id must not leak into Character Lore filtering.
    {
      characterId: "deleted-character-id",
      name: "Former Character",
    },
  ],
};

assert.deepEqual(
  resolveLoreCharacterIdsFromTrackerState(trackerState, library),
  [evaId],
  "Only canonical Character Library identities from Tracker state may enter Lore scope",
);

assert.deepEqual(
  resolveLoreCharacterIdsFromTrackerState(
    {
      presentCharacters: [
        {
          characterId: evaId.toLowerCase(),
          name: "Eva Green",
        },
      ],
    },
    library,
  ),
  [evaId],
  "Tracker id matching must return the canonical Character Library id",
);

assert.deepEqual(
  resolveLoreCharacterIdsFromTrackerState(
    {
      presentCharacters: [
        {
          characterId: "Mrs. Eleanor Marlowe",
          name: "Mrs. Eleanor Marlowe",
        },
      ],
    },
    library,
  ),
  [],
  "An NPC-only Tracker state must not create Character Lore ownership scope",
);

assert.deepEqual(resolveLoreCharacterIdsFromTrackerState(null, library), []);

assert.deepEqual(resolveLoreCharacterIdsFromTrackerState({}, library), []);

assert.deepEqual(
  resolveLoreCharacterIdsFromText("Ева входит в кабинет.", library),
  [evaId],
  "Current-turn alias bootstrap must still resolve an off-roster Character Card",
);

const promptCharacterIds: string[] = [];
const trackerLoreCharacterIds = resolveLoreCharacterIdsFromTrackerState(
  trackerState,
  library,
);
const bootstrapLoreCharacterIds = resolveLoreCharacterIdsFromText(
  "Я протягиваю ей папку.",
  library,
);

const effectiveLoreCharacterIds = Array.from(
  new Set([
    ...promptCharacterIds,
    ...trackerLoreCharacterIds,
    ...bootstrapLoreCharacterIds,
  ]),
);

assert.deepEqual(
  bootstrapLoreCharacterIds,
  [],
  "Pronoun-only later turn should not require another text bootstrap",
);

assert.deepEqual(
  effectiveLoreCharacterIds,
  [evaId],
  "A Character Card already present in authoritative Tracker state must remain Lore-eligible on the next turn",
);

console.info("Roleplay Lore Character identity regression passed.");
