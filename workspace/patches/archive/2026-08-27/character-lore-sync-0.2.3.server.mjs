const PACKAGE_ID = "character-lore-sync";
const STATE_KIND = "chat-state";
const STATE_VERSION = 2;

const warned = new Set();

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value) {
  return isRecord(value) ? value : {};
}

function readStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
}

function parseChatMetadata(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(value) ? value : {};
}

function parseLorebookData(book) {
  return asRecord(book?.data);
}

function lorebookName(book) {
  const data = parseLorebookData(book);
  return typeof data.name === "string" && data.name.trim()
    ? data.name.trim()
    : book?.id ?? "Unknown lorebook";
}

function lorebookCharacterIds(book) {
  const data = parseLorebookData(book);
  const ids = readStringArray(data.characterIds);
  if (typeof data.characterId === "string" && data.characterId.trim()) {
    ids.push(data.characterId.trim());
  }
  return Array.from(new Set(ids));
}

function normalizeEntryMap(value) {
  const result = {};
  for (const [characterId, raw] of Object.entries(asRecord(value))) {
    const item = asRecord(raw);
    if (typeof item.entryId !== "string" || !item.entryId.trim()) continue;
    result[characterId] = {
      entryId: item.entryId.trim(),
      characterName:
        typeof item.characterName === "string" && item.characterName.trim()
          ? item.characterName.trim()
          : characterId,
      lorebookId:
        typeof item.lorebookId === "string" && item.lorebookId.trim()
          ? item.lorebookId.trim()
          : null,
    };
  }
  return result;
}

function normalizeState(document) {
  const data = asRecord(document?.data);
  const version = Number(data.version ?? 1);

  const legacyEntries =
    version < 2
      ? normalizeEntryMap(data.outfitEntries)
      : normalizeEntryMap(data.legacyEntries);

  return {
    version: STATE_VERSION,
    enabled: data.enabled !== false,
    targetLorebookId:
      typeof data.targetLorebookId === "string" && data.targetLorebookId.trim()
        ? data.targetLorebookId.trim()
        : null,
    cardEntries: normalizeEntryMap(data.cardEntries),
    npcEntries: normalizeEntryMap(data.npcEntries),
    legacyEntries,
  };
}

async function loadState(persistence, chatId) {
  const document = await persistence.documents.getById(PACKAGE_ID, chatId);
  return { document, state: normalizeState(document) };
}

async function saveState(persistence, chat, document, state) {
  const timestamp = nowIso();
  const data = {
    version: STATE_VERSION,
    enabled: state.enabled,
    targetLorebookId: state.targetLorebookId,
    cardEntries: state.cardEntries,
    npcEntries: state.npcEntries,
    legacyEntries: state.legacyEntries,
  };

  if (!document) {
    return persistence.documents.create({
      id: chat.id,
      packageId: PACKAGE_ID,
      kind: STATE_KIND,
      name: `Character Lore Sync — ${chat.name || chat.id}`,
      description: "Per-chat Character Lore Sync configuration and managed Lore entry identities.",
      data,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return persistence.documents.update({
    id: document.id,
    packageId: PACKAGE_ID,
    expectedRevision: document.revision,
    name: document.name,
    description: document.description,
    data,
    updatedAt: timestamp,
  });
}

async function entryExists(persistence, entryId) {
  if (!entryId) return false;
  const existing = await persistence.listExistingLorebookEntryIds([entryId]);
  return existing.includes(entryId);
}

function isManagedDescription(value) {
  return (
    typeof value === "string" &&
    value.includes("Managed automatically by Character Lore Sync")
  );
}

async function listManagedEntries(resources, lorebookId, expectedNames) {
  const [book] = await resources.listLorebooks([lorebookId]);
  if (!book || !Array.isArray(book.entries)) return [];

  const names = new Set(expectedNames);
  return book.entries.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry;
    return (
      typeof row.id === "string" &&
      typeof row.name === "string" &&
      names.has(row.name) &&
      isManagedDescription(row.description)
    );
  });
}

async function chooseCanonicalManagedEntry({
  persistence,
  resources,
  lorebookId,
  expectedNames,
  preferredEntryIds,
  logger,
}) {
  const candidates = await listManagedEntries(resources, lorebookId, expectedNames);
  if (candidates.length === 0) {
    for (const entryId of preferredEntryIds) {
      if (entryId && (await entryExists(persistence, entryId))) {
        return { canonicalId: entryId, duplicateIds: [] };
      }
    }
    return { canonicalId: null, duplicateIds: [] };
  }

  const candidateIds = new Set(candidates.map((entry) => entry.id));
  let canonicalId = null;

  for (const preferred of preferredEntryIds) {
    if (preferred && candidateIds.has(preferred)) {
      canonicalId = preferred;
      break;
    }
  }

  canonicalId ??= candidates[0].id;

  const duplicateIds = candidates
    .map((entry) => entry.id)
    .filter((entryId) => entryId !== canonicalId);

  if (duplicateIds.length > 0) {
    logger?.warn?.(
      `[character-lore-sync] repairing ${duplicateIds.length} duplicate managed Lore entr${duplicateIds.length === 1 ? "y" : "ies"} in ${lorebookId}`,
    );
  }

  return { canonicalId, duplicateIds };
}

async function removeEntryQuietly(resources, entryId, logger) {
  if (!entryId || typeof resources.removeLorebookEntry !== "function") return;
  try {
    await resources.removeLorebookEntry(entryId);
  } catch (error) {
    logger?.warn?.(error, `[character-lore-sync] could not remove migrated entry ${entryId}`);
  }
}

async function resolvePinnedLorebook(resources, chat, state) {
  const books = await resources.listLorebooks();
  const byId = new Map(books.map((book) => [book.id, book]));
  const metadata = parseChatMetadata(chat.metadata);
  const activeIds = readStringArray(metadata.activeLorebookIds).filter((id) => byId.has(id));

  if (activeIds.length === 1) {
    const id = activeIds[0];
    return { id, name: lorebookName(byId.get(id)) };
  }

  if (activeIds.length === 0 && state.targetLorebookId && byId.has(state.targetLorebookId)) {
    return { id: state.targetLorebookId, name: lorebookName(byId.get(state.targetLorebookId)) };
  }

  return null;
}

async function classifyTrackerCharacter(resources, character) {
  if (!character?.characterId) return { kind: "npc", card: null };
  if (character.characterId.startsWith("NPC_")) return { kind: "npc", card: null };

  const rows = await resources.listCharacters([character.characterId]);
  const card = rows.find((row) => row.id === character.characterId) ?? null;
  return card ? { kind: "card", card } : { kind: "npc", card: null };
}

async function resolveCharacterLorebook(resources, characterId, characterName) {
  const books = await resources.listLorebooks();
  const linked = books.filter((book) => lorebookCharacterIds(book).includes(characterId));

  if (linked.length === 1) return linked[0];

  if (linked.length > 1) {
    const characterCategory = linked.filter(
      (book) => parseLorebookData(book).category === "character",
    );
    if (characterCategory.length === 1) return characterCategory[0];

    const nameMatches = linked.filter((book) =>
      lorebookName(book).toLowerCase().includes(characterName.toLowerCase()),
    );
    if (nameMatches.length === 1) return nameMatches[0];

    return null;
  }

  if (typeof resources.createLorebook !== "function") return null;

  return resources.createLorebook({
    name: `${characterName} — Dynamic Character State`,
    description:
      "Character-linked dynamic state maintained automatically by Character Lore Sync.",
    category: "character",
    characterId,
    enabled: true,
  });
}

function characterName(character) {
  return typeof character?.name === "string" && character.name.trim()
    ? character.name.trim()
    : character?.characterId ?? "Unknown character";
}

function cardOutfitName(name) {
  return `${name} - Current Outfit`;
}

function cardOutfitContent(name, outfit) {
  return `${name}'s current outfit: ${outfit}`;
}

function parseCharacterCardData(card) {
  const value = card?.data;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return asRecord(value);
}

function buildCardNameKeys(card, name) {
  const fullName = String(name ?? "").trim().replace(/\s+/g, " ");
  const result = [];
  if (fullName) result.push(fullName);

  const cardData = parseCharacterCardData(card);
  for (const tag of readStringArray(cardData.tags)) {
    result.push(tag);
  }

  // A card Character has a stable identity, so its short given-name alias is
  // safe and useful for ordinary dialogue references.
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length >= 2) result.push(parts[0]);

  return Array.from(new Set(result.map((value) => value.trim()).filter(Boolean)));
}

function cardOutfitDescription(name) {
  return `Current outfit and worn-item state for ${name}, maintained from Character Tracker state. Managed automatically by Character Lore Sync.`;
}

const NPC_TITLE_TOKENS = new Set([
  "mr", "mrs", "ms", "miss", "dr", "prof", "professor", "sir", "dame",
  "lady", "lord", "capt", "captain", "inspector", "detective", "sergeant",
  "sgt", "officer", "father", "mother", "sister", "brother", "rev",
  "reverend", "count", "countess", "duke", "duchess", "baron", "baroness",
  "prince", "princess",
]);

function normalizedTitleToken(value) {
  return String(value).toLowerCase().replace(/[^a-z]/g, "");
}

function buildNpcNameKeys(name) {
  const fullName = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!fullName) return [];

  const parts = fullName.split(" ");
  const result = [fullName];
  const hasTitle = parts.length >= 2 && NPC_TITLE_TOKENS.has(normalizedTitleToken(parts[0]));

  if (hasTitle) {
    const title = parts[0];
    const personal = parts.slice(1);
    const first = personal[0] ?? "";
    const last = personal.length >= 2 ? personal[personal.length - 1] : "";

    if (last) result.push(`${title} ${last}`);
    if (first && last) result.push(`${first} ${last}`);
    if (first) result.push(`${title} ${first}`);
    if (first) result.push(first);
  } else if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (parts.length > 2) result.push(`${first} ${last}`);
    result.push(first);
  }

  return Array.from(new Set(result.map((value) => value.trim()).filter(Boolean)));
}

function npcDescription(name) {
  return `Persistent memory for ${name}: identity, appearance, last known outfit, emotional state, relationships, thoughts, and other Character Tracker details. Managed automatically by Character Lore Sync.`;
}

function formatValue(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function titleCaseKey(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function npcStateContent(character) {
  const name = characterName(character);
  const lines = [
    `${name} — persistent NPC record from the last observed Character Tracker state:`,
  ];

  if (typeof character.mood === "string" && character.mood.trim()) {
    lines.push(`Last known mood: ${character.mood.trim()}`);
  }
  if (typeof character.appearance === "string" && character.appearance.trim()) {
    lines.push(`Appearance: ${character.appearance.trim()}`);
  }
  if (typeof character.outfit === "string" && character.outfit.trim()) {
    lines.push(`Last known outfit: ${character.outfit.trim()}`);
  }
  if (typeof character.thoughts === "string" && character.thoughts.trim()) {
    lines.push(`Last known thoughts/context: ${character.thoughts.trim()}`);
  }

  const customFields = asRecord(character.customFields);
  for (const [key, value] of Object.entries(customFields)) {
    const formatted = formatValue(value);
    if (!formatted) continue;
    lines.push(`${titleCaseKey(key)}: ${formatted}`);
  }

  if (Array.isArray(character.stats)) {
    for (const raw of character.stats) {
      const stat = asRecord(raw);
      const statName =
        typeof stat.name === "string" && stat.name.trim() ? stat.name.trim() : null;
      if (!statName) continue;
      const value = formatValue(stat.value);
      const max = formatValue(stat.max);
      if (!value) continue;
      lines.push(`${statName}: ${value}${max ? `/${max}` : ""}`);
    }
  }

  return lines.join("\n");
}

async function syncCardCharacter({
  persistence,
  resources,
  character,
  card,
  mapping,
  legacyMapping,
  logger,
}) {
  const id = character.characterId;
  const name = characterName(character);
  const outfit = typeof character.outfit === "string" ? character.outfit.trim() : "";
  if (!id || !name || !outfit) return false;

  const lorebook = await resolveCharacterLorebook(resources, id, name);
  if (!lorebook) {
    const key = `card-lorebook:${id}`;
    if (!warned.has(key)) {
      warned.add(key);
      logger?.warn?.(
        `[character-lore-sync] could not resolve one Character Lorebook for ${name} (${id}); outfit sync skipped`,
      );
    }
    return false;
  }
  warned.delete(`card-lorebook:${id}`);

  const targetLorebookId = lorebook.id;
  const current = mapping[id] ?? null;
  const legacy = legacyMapping[id] ?? null;

  const nameValue = cardOutfitName(name);
  const content = cardOutfitContent(name, outfit);
  const description = cardOutfitDescription(name);
  const keys = buildCardNameKeys(card, name);

  const repair = await chooseCanonicalManagedEntry({
    persistence,
    resources,
    lorebookId: targetLorebookId,
    expectedNames: [nameValue],
    preferredEntryIds: [current?.entryId, legacy?.entryId].filter(Boolean),
    logger,
  });

  if (repair.canonicalId) {
    await resources.updateLorebookEntry(repair.canonicalId, {
      name: nameValue,
      content,
      description,
      keys,
      secondaryKeys: [],
    });

    for (const duplicateId of repair.duplicateIds) {
      await removeEntryQuietly(resources, duplicateId, logger);
    }

    mapping[id] = {
      entryId: repair.canonicalId,
      characterName: name,
      lorebookId: targetLorebookId,
    };
    delete legacyMapping[id];
    return true;
  }

  const created = await resources.createLorebookEntry(targetLorebookId, {
    name: nameValue,
    content,
    description,
    keys,
    secondaryKeys: [],
    enabled: true,
    constant: true,
    selective: false,
    matchWholeWords: false,
    preventRecursion: true,
    excludeRecursion: true,
    excludeFromVectorization: true,
    characterFilterMode: "include",
    characterFilterIds: [id],
  });

  mapping[id] = { entryId: created.id, characterName: name, lorebookId: targetLorebookId };

  delete legacyMapping[id];
  return true;
}

async function syncNpc({
  persistence,
  resources,
  targetLorebook,
  character,
  mapping,
  legacyMapping,
  logger,
}) {
  if (!targetLorebook) return false;

  const id = character.characterId;
  const name = characterName(character);
  if (!id || !name) return false;

  const current = mapping[id] ?? null;
  const legacy = legacyMapping[id] ?? null;

  const nameValue = `${name} - Current State`;
  const legacyNameValue = `${name} - Current Outfit`;
  const content = npcStateContent(character);
  const description = npcDescription(name);
  const keys = buildNpcNameKeys(name);

  const repair = await chooseCanonicalManagedEntry({
    persistence,
    resources,
    lorebookId: targetLorebook.id,
    expectedNames: [nameValue, legacyNameValue],
    preferredEntryIds: [current?.entryId, legacy?.entryId].filter(Boolean),
    logger,
  });

  // v0.2.2 changes NPC Lore from constant scene context into persistent,
  // keyword-activated memory. The Capability API 1.14 narrow update surface
  // does not expose `constant`, so migrate an older constant managed entry by
  // replacing it once. Subsequent turns update the stable non-constant entry.
  let canonicalEntry = null;
  if (repair.canonicalId) {
    const [targetBook] = await resources.listLorebooks([targetLorebook.id]);
    canonicalEntry = Array.isArray(targetBook?.entries)
      ? targetBook.entries.find((entry) => entry?.id === repair.canonicalId) ?? null
      : null;
  }

  const needsNonConstantMigration =
    repair.canonicalId && (!canonicalEntry || canonicalEntry.constant !== false);

  if (repair.canonicalId && !needsNonConstantMigration) {
    await resources.updateLorebookEntry(repair.canonicalId, {
      name: nameValue,
      content,
      description,
      keys,
      secondaryKeys: [],
    });

    for (const duplicateId of repair.duplicateIds) {
      await removeEntryQuietly(resources, duplicateId, logger);
    }

    mapping[id] = {
      entryId: repair.canonicalId,
      characterName: name,
      lorebookId: targetLorebook.id,
    };
    delete legacyMapping[id];
    return true;
  }

  const created = await resources.createLorebookEntry(targetLorebook.id, {
    name: nameValue,
    content,
    description,
    keys,
    secondaryKeys: [],
    enabled: true,
    constant: false,
    selective: false,
    matchWholeWords: false,
    preventRecursion: true,
    excludeRecursion: true,
    excludeFromVectorization: true,
  });

  if (repair.canonicalId) {
    await removeEntryQuietly(resources, repair.canonicalId, logger);
  }
  for (const duplicateId of repair.duplicateIds) {
    await removeEntryQuietly(resources, duplicateId, logger);
  }

  mapping[id] = {
    entryId: created.id,
    characterName: name,
    lorebookId: targetLorebook.id,
  };

  delete legacyMapping[id];
  return true;
}

export async function activate(context) {
  const runtime = context?.api?.runtime;
  const persistence = runtime?.persistence;
  const resources = runtime?.resources;
  const logger = runtime?.logger;

  if (!runtime || !persistence || !resources) {
    throw new Error("Character Lore Sync requires server runtime persistence and resources.");
  }
  if (typeof context.api.registerAgentPipelineSettledHandler !== "function") {
    throw new Error("Character Lore Sync 0.2.2 requires Capability API 1.14 lifecycle support.");
  }
  if (typeof persistence.getCharacterTrackerState !== "function") {
    throw new Error("Character Lore Sync 0.2.2 requires anchored Character Tracker reads.");
  }
  if (
    typeof resources.createLorebookEntry !== "function" ||
    typeof resources.updateLorebookEntry !== "function" ||
    typeof resources.removeLorebookEntry !== "function"
  ) {
    throw new Error("Character Lore Sync 0.2.2 requires Capability API 1.14 Lore entry writes.");
  }

  logger?.info?.("[character-lore-sync] activated v0.2.2");

  return context.api.registerAgentPipelineSettledHandler(
    async ({ chatId, messageId, swipeIndex }) => {
      await persistence.withChatLock(chatId, async () => {
        const chat = await persistence.getChat(chatId);
        if (!chat) return;

        const { document, state } = await loadState(persistence, chatId);
        if (!state.enabled) return;

        const characters = await persistence.getCharacterTrackerState(
          chatId,
          messageId,
          swipeIndex,
        );
        if (!Array.isArray(characters) || characters.length === 0) return;

        const classifications = await Promise.all(
          characters.map(async (character) => ({
            character,
            classification: await classifyTrackerCharacter(resources, character),
          })),
        );

        const hasNpc = classifications.some((item) => item.classification.kind === "npc");
        const pinnedLorebook = hasNpc
          ? await resolvePinnedLorebook(resources, chat, state)
          : null;

        if (hasNpc && !pinnedLorebook) {
          const key = `npc-target:${chatId}`;
          if (!warned.has(key)) {
            warned.add(key);
            logger?.warn?.(
              `[character-lore-sync] NPC state needs exactly one chat-pinned Lorebook for chat ${chatId}`,
            );
          }
        } else {
          warned.delete(`npc-target:${chatId}`);
        }

        let stateChanged = false;
        if (pinnedLorebook && state.targetLorebookId !== pinnedLorebook.id) {
          state.targetLorebookId = pinnedLorebook.id;
          stateChanged = true;
        }

        let cardCount = 0;
        let npcCount = 0;

        for (const { character, classification } of classifications) {
          if (classification.kind === "card") {
            const synced = await syncCardCharacter({
              persistence,
              resources,
              character,
              card: classification.card,
              mapping: state.cardEntries,
              legacyMapping: state.legacyEntries,
              logger,
            });
            if (synced) {
              cardCount += 1;
              stateChanged = true;
            }
          } else if (pinnedLorebook) {
            const synced = await syncNpc({
              persistence,
              resources,
              targetLorebook: pinnedLorebook,
              character,
              mapping: state.npcEntries,
              legacyMapping: state.legacyEntries,
              logger,
            });
            if (synced) {
              npcCount += 1;
              stateChanged = true;
            }
          }
        }

        if (stateChanged || !document) {
          const saved = await saveState(persistence, chat, document, state);
          if (!saved) {
            logger?.warn?.(
              `[character-lore-sync] state revision changed while syncing chat ${chatId}; next turn will retry`,
            );
          }
        }

        logger?.debug?.(
          `[character-lore-sync] v0.2.2 synced ${cardCount} card character(s) and ${npcCount} NPC(s) for chat ${chatId}`,
        );
      });
    },
  );
}
