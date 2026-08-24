#!/usr/bin/env python3
"""Add lore-only Character activation from constant active Lore registry entries.

This patch deliberately does not alter scene presence, chat roster, or Tracker state.
It scans constant entries in lorebooks already relevant to the request, resolves exact
Character Card names mentioned by those entries, and adds the resulting canonical IDs
only to the standard lorebook character-filter scope.

That lets an organizational registry such as "Pentad Bureau - Structure" make the
member Character Lore eligible before a Character first appears, without running an
extra LLM and without asserting that every listed member is physically present.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path.cwd()
REL = "packages/server/src/routes/generate.routes.ts"
MARKER = "CHARACTER_LORE_REGISTRY_IDS_V1"

path = ROOT / REL
if not path.exists():
    raise SystemExit("Run this script from the Marinara-Engine repository root.")

text = path.read_text(encoding="utf-8")
if MARKER in text:
    print("Character Lore registry activation already present.")
    raise SystemExit(0)

old = '''        const effectiveLorebookCharacterIds = Array.from(
          new Set([...promptCharacterIds, ...trackerCarryForwardCharacterIds]),
        );
'''
if text.count(old) != 1:
    raise SystemExit(f"effective lore ID anchor: expected exactly one match, found {text.count(old)}")

new = '''        // CHARACTER_LORE_REGISTRY_IDS_V1
        // Constant entries in already-relevant Lorebooks may act as deterministic
        // identity registries. Exact Character Card names mentioned there become
        // lore-eligible only; they are NOT added to scene presence, chat roster,
        // agentContext.characters, or Character Tracker state by this mechanism.
        const registryLoreEntries = await lorebooksStore.listActiveEntries({
          activeLorebookIds: chatActiveLorebookIds,
          characterIds: promptCharacterIds,
          personaId,
          chatId: input.chatId,
          excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
          excludedSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
        });
        const registryLoreText = registryLoreEntries
          .filter((entry) => {
            const candidate = entry as Record<string, unknown>;
            const characterFilterIds = Array.isArray(candidate.characterFilterIds)
              ? candidate.characterFilterIds
              : [];
            return candidate.constant === true && characterFilterIds.length === 0;
          })
          .map((entry) => {
            const candidate = entry as Record<string, unknown>;
            return [candidate.name, candidate.description, candidate.content]
              .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
              .join("\\n");
          })
          .join("\\n")
          .toLocaleLowerCase();

        const registryCharacterIds: string[] = [];
        if (registryLoreText) {
          for (const row of await chars.list()) {
            try {
              const parsed = JSON.parse(row.data) as { name?: unknown };
              const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
              if (!name || registryCharacterIds.includes(row.id)) continue;
              if (registryLoreText.includes(name.toLocaleLowerCase())) registryCharacterIds.push(row.id);
            } catch {
              // Invalid Character Card JSON must not break generation; normal card
              // loaders will surface card-specific problems when that card is used.
            }
          }
        }

        const effectiveLorebookCharacterIds = Array.from(
          new Set([...promptCharacterIds, ...trackerCarryForwardCharacterIds, ...registryCharacterIds]),
        );
        if (registryCharacterIds.length > 0) {
          logger.info(
            "[character-lore-registry] Lore-only activated %d Character Card(s): %s",
            registryCharacterIds.length,
            registryCharacterIds.join(", "),
          );
        }
'''

path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Deterministic Character Lore registry activation applied successfully.")
