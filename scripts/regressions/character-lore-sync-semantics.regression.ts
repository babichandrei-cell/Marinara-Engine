import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const serverPath = process.env.CHARACTER_LORE_SYNC_SERVER;
if (!serverPath) {
  throw new Error(
    "CHARACTER_LORE_SYNC_SERVER must point to the Character Lore Sync server.mjs under test",
  );
}

const module = await import(`${pathToFileURL(serverPath).href}?test=${Date.now()}`);
assert.equal(typeof module.activate, "function", "Capability package must export activate()");

type Entry = {
  id: string;
  lorebookId: string;
  name: string;
  content: string;
  description: string;
  keys: string[];
  secondaryKeys: string[];
  enabled?: boolean;
  constant?: boolean;
  [key: string]: unknown;
};

const cardCharacterId = "character-eva";
const npcCharacterId = "NPC_Eleanor_Marlowe";
const cardLorebookId = "book-eva";
const worldLorebookId = "book-alderwick";

const lorebooks = new Map<string, {
  id: string;
  data: Record<string, unknown>;
  entries: Entry[];
}>([
  [
    cardLorebookId,
    {
      id: cardLorebookId,
      data: {
        name: "Eva Green — Eva Green",
        category: "character",
        characterId: cardCharacterId,
        characterIds: [cardCharacterId],
        enabled: true,
      },
      entries: [],
    },
  ],
  [
    worldLorebookId,
    {
      id: worldLorebookId,
      data: {
        name: "Alderwick",
        category: "chat",
        enabled: true,
      },
      entries: [],
    },
  ],
]);

const evaCard = {
  id: cardCharacterId,
  data: JSON.stringify({
    name: "Eva Green",
    tags: [
      "Ева",
      "Ева Грин",
      "Еве",
      "Еву",
      "Евой",
      "Евы",
      "Eva Green",
      "Eva",
    ],
  }),
  comment: "",
};

const trackerByMessage = new Map<string, unknown[]>([
  [
    "message-1",
    [
      {
        characterId: cardCharacterId,
        name: "Eva Green",
        outfit: "Black silk corset, mini-skirt, stockings and gloves.",
      },
      {
        characterId: npcCharacterId,
        name: "Mrs. Eleanor Marlowe",
        mood: "anxious",
        appearance: "Middle-aged woman with pale skin and hair in a tight bun.",
        outfit: "Victorian dark day dress and gloves.",
        thoughts: "I must find Lydia.",
        customFields: {
          Relation: "Mother of Lydia",
        },
        stats: [
          {
            name: "Desperation",
            value: 85,
            max: 100,
          },
        ],
      },
    ],
  ],
  [
    "message-2",
    [
      {
        characterId: cardCharacterId,
        name: "Eva Green",
        outfit: "Black fitted evening dress and long gloves.",
      },
    ],
  ],
  [
    "message-3",
    [
      {
        characterId: npcCharacterId,
        name: "Mrs. Eleanor Marlowe",
        mood: "relieved",
        appearance: "Middle-aged woman with pale skin and hair in a tight bun.",
        outfit: "Victorian dark day dress, gloves removed.",
        thoughts: "Perhaps they can really help me.",
        customFields: {
          Relation: "Mother of Lydia",
        },
        stats: [
          {
            name: "Desperation",
            value: 70,
            max: 100,
          },
        ],
      },
    ],
  ],
]);

let document: any = null;
let documentRevision = 0;
let registeredHandler: ((event: any) => Promise<void>) | null = null;
let entrySequence = 0;
const removedEntryIds: string[] = [];

function allEntries(): Entry[] {
  return [...lorebooks.values()].flatMap((book) => book.entries);
}

function findEntry(entryId: string): Entry | null {
  return allEntries().find((entry) => entry.id === entryId) ?? null;
}

const persistence = {
  documents: {
    async getById(_packageId: string, _id: string) {
      return document;
    },
    async create(input: any) {
      documentRevision += 1;
      document = {
        ...input,
        revision: documentRevision,
      };
      return document;
    },
    async update(input: any) {
      assert.equal(input.expectedRevision, document?.revision);
      documentRevision += 1;
      document = {
        ...document,
        ...input,
        revision: documentRevision,
      };
      return document;
    },
  },
  async withChatLock(_chatId: string, fn: () => Promise<void>) {
    return fn();
  },
  async getChat(chatId: string) {
    return {
      id: chatId,
      name: "Regression Chat",
      metadata: JSON.stringify({
        activeLorebookIds: [worldLorebookId],
      }),
    };
  },
  async getCharacterTrackerState(
    _chatId: string,
    messageId: string,
    _swipeIndex: number,
  ) {
    return trackerByMessage.get(messageId) ?? [];
  },
  async listExistingLorebookEntryIds(entryIds: string[]) {
    const existing = new Set(allEntries().map((entry) => entry.id));
    return entryIds.filter((id) => existing.has(id));
  },
};

const resources = {
  async listCharacters(characterIds?: string[]) {
    if (!characterIds || characterIds.includes(cardCharacterId)) return [evaCard];
    return [];
  },

  async listLorebooks(lorebookIds?: string[]) {
    const books = lorebookIds
      ? lorebookIds.map((id) => lorebooks.get(id)).filter(Boolean)
      : [...lorebooks.values()];

    return books.map((book: any) => ({
      id: book.id,
      data: book.data,
      entries: book.entries.map((entry: Entry) => ({ ...entry })),
    }));
  },

  async createLorebook(input: any) {
    const id = `created-book-${lorebooks.size + 1}`;
    const book = { id, data: { ...input }, entries: [] as Entry[] };
    lorebooks.set(id, book);
    return { id, data: book.data, entries: [] };
  },

  async createLorebookEntry(lorebookId: string, input: any) {
    const book = lorebooks.get(lorebookId);
    assert.ok(book, `Unknown lorebook ${lorebookId}`);
    entrySequence += 1;
    const entry: Entry = {
      id: `entry-${entrySequence}`,
      lorebookId,
      name: input.name,
      content: input.content,
      description: input.description,
      keys: [...(input.keys ?? [])],
      secondaryKeys: [...(input.secondaryKeys ?? [])],
      ...input,
    };
    book.entries.push(entry);
    return {
      id: entry.id,
      lorebookId,
      lorebookName: String(book.data.name ?? lorebookId),
      name: entry.name,
      content: entry.content,
      description: entry.description,
    };
  },

  async updateLorebookEntry(entryId: string, updates: any) {
    const entry = findEntry(entryId);
    assert.ok(entry, `Unknown entry ${entryId}`);
    Object.assign(entry, updates);
  },

  async removeLorebookEntry(entryId: string) {
    removedEntryIds.push(entryId);
    for (const book of lorebooks.values()) {
      const index = book.entries.findIndex((entry) => entry.id === entryId);
      if (index >= 0) {
        book.entries.splice(index, 1);
        return;
      }
    }
  },
};

const logger = {
  info() {},
  debug() {},
  warn() {},
  error() {},
};

const cleanup = await module.activate({
  api: {
    runtime: {
      persistence,
      resources,
      logger,
    },
    registerAgentPipelineSettledHandler(handler: (event: any) => Promise<void>) {
      registeredHandler = handler;
      return () => {
        registeredHandler = null;
      };
    },
  },
});

assert.equal(typeof cleanup, "function");
assert.ok(registeredHandler);

await registeredHandler!({
  chatId: "chat-1",
  generationId: "generation-1",
  messageId: "message-1",
  swipeIndex: 0,
});

const evaEntry = lorebooks
  .get(cardLorebookId)!
  .entries.find((entry) => entry.name === "Eva Green - Current Outfit");

assert.ok(evaEntry, "Card Character Current Outfit entry must be created");
assert.equal(evaEntry.constant, true, "Card Character Current Outfit remains constant");
assert.match(
  evaEntry.description,
  /Current outfit and worn-item state for Eva Green/,
  "Card Character Description must be character-specific",
);
assert.match(
  evaEntry.description,
  /Character Tracker state/,
  "Card Character Description must identify Tracker provenance",
);
assert.deepEqual(
  new Set(evaEntry.keys),
  new Set([
    "Eva Green",
    "Eva",
    "Ева",
    "Ева Грин",
    "Еве",
    "Еву",
    "Евой",
    "Евы",
  ]),
  "Card Character Current Outfit must use full name, short name, and card tags",
);

const npcEntry = lorebooks
  .get(worldLorebookId)!
  .entries.find((entry) => entry.name === "Mrs. Eleanor Marlowe - Current State");

assert.ok(npcEntry, "NPC persistent memory entry must be created");
assert.equal(
  npcEntry.constant,
  false,
  "NPC memory must be keyword-activated, never constant scene context",
);
assert.deepEqual(
  npcEntry.keys,
  [
    "Mrs. Eleanor Marlowe",
    "Mrs. Marlowe",
    "Eleanor Marlowe",
    "Mrs. Eleanor",
    "Eleanor",
  ],
  "NPC aliases must be conservative and deterministic",
);
assert.match(
  npcEntry.description,
  /Persistent memory for Mrs\. Eleanor Marlowe/,
  "NPC Description must be tied to the concrete NPC",
);
assert.match(npcEntry.content, /persistent NPC record/);
assert.match(npcEntry.content, /Last known mood: anxious/);
assert.match(npcEntry.content, /Last known outfit:/);
assert.match(npcEntry.content, /Relation: Mother of Lydia/);
assert.match(npcEntry.content, /Desperation: 85\/100/);

const npcEntryId = npcEntry.id;

await registeredHandler!({
  chatId: "chat-1",
  generationId: "generation-2",
  messageId: "message-2",
  swipeIndex: 0,
});

assert.ok(
  findEntry(npcEntryId),
  "NPC memory must persist when NPC disappears from current Character Tracker state",
);
assert.ok(
  !removedEntryIds.includes(npcEntryId),
  "NPC memory must not be deleted merely because NPC left the scene",
);

const updatedEva = findEntry(evaEntry.id);
assert.ok(updatedEva);
assert.match(
  updatedEva.content,
  /Black fitted evening dress and long gloves/,
  "Card Current Outfit must stable-upsert on later Tracker state",
);

await registeredHandler!({
  chatId: "chat-1",
  generationId: "generation-3",
  messageId: "message-3",
  swipeIndex: 0,
});

const returnedNpc = findEntry(npcEntryId);
assert.ok(
  returnedNpc,
  "Returning NPC must update the same persistent Lore entry instead of creating a new identity",
);
assert.match(returnedNpc.content, /Last known mood: relieved/);
assert.match(returnedNpc.content, /Desperation: 70\/100/);

const matchingNpcEntries = lorebooks
  .get(worldLorebookId)!
  .entries.filter((entry) => entry.name === "Mrs. Eleanor Marlowe - Current State");

assert.equal(
  matchingNpcEntries.length,
  1,
  "Returning NPC must not create duplicate persistent memories",
);

cleanup();

console.info("Character Lore Sync semantic behavior regression passed.");
