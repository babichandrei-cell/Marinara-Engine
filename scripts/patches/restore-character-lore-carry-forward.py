#!/usr/bin/env python3
"""Restore canonical Tracker -> request-scoped Character Card/Lore carry-forward.

This is intentionally a small, fail-fast patcher. It restores only the deterministic
part of the previously tested Character Activation Runtime:

1. Canonical Character Tracker presentCharacters IDs from the anchored prior state
   are resolved against Character storage.
2. Matching Character Cards are loaded request-scoped without mutating chat.characterIds.
3. Those canonical IDs are also added to the ordinary World Lore character-filter
   scope, so entries using characterFilterIds activate on the next turn.
4. Marinara's existing buildReferencedCharacterContext() supplies the canonical card
   block to the main prompt and Character Tracker.
5. Illustrator ordering/current-turn Tracker handling is untouched.

The older LLM Character Router and Missing Character Recovery are deliberately NOT
restored by this patch.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path.cwd()
MARKER = "CHARACTER_LORE_CARRY_FORWARD_V1"
LORE_IDS_MARKER = "CHARACTER_LORE_EFFECTIVE_IDS_V1"


def read(rel: str) -> str:
    path = ROOT / rel
    if not path.exists():
        raise SystemExit(f"Missing Engine file: {rel}")
    return path.read_text(encoding="utf-8")


def write(rel: str, text: str) -> None:
    (ROOT / rel).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)


def require_repo() -> None:
    if not (ROOT / "packages/server/src/routes/generate.routes.ts").exists():
        raise SystemExit("Run this script from the Marinara-Engine repository root.")


require_repo()

# ---------------------------------------------------------------------------
# 1. Export Marinara's existing referenced-character context builder.
# ---------------------------------------------------------------------------
rel = "packages/server/src/services/prompt/index.ts"
text = read(rel)
if "buildReferencedCharacterContext," not in text:
    text = replace_once(
        text,
        "  buildPromptMacroContext,\n",
        "  buildPromptMacroContext,\n  buildReferencedCharacterContext,\n",
        "prompt referenced-character export",
    )
    write(rel, text)

# ---------------------------------------------------------------------------
# 2. Prompt assembler: keep roster/card semantics separate from lore filters.
#    `characterIds` continues to mean the normal prompt roster. The optional
#    `lorebookCharacterIds` is used only by lorebook matching.
# ---------------------------------------------------------------------------
rel = "packages/server/src/services/prompt/assembler.ts"
text = read(rel)
if "lorebookCharacterIds?: string[];" not in text:
    text = replace_once(
        text,
        "  characterIds: string[];\n  /** Full active roster when characterIds is narrowed to one generation target. */\n",
        "  characterIds: string[];\n  /** Request-scoped character IDs used only for lorebook character filters. */\n  lorebookCharacterIds?: string[];\n  /** Full active roster when characterIds is narrowed to one generation target. */\n",
        "assembler lorebook character ids field",
    )
if "characterIds: input.lorebookCharacterIds ?? input.characterIds," not in text:
    text = replace_once(
        text,
        "    characterIds: input.characterIds,\n    personaId: input.personaId ?? null,\n",
        "    characterIds: input.lorebookCharacterIds ?? input.characterIds,\n    personaId: input.personaId ?? null,\n",
        "assembler marker lore character ids",
    )
write(rel, text)

# ---------------------------------------------------------------------------
# 3. Main generation runtime: deterministic canonical Tracker carry-forward.
#    Resolve IDs before the normal lorebook scan so World Lore entries with
#    characterFilterIds can activate on the very next turn.
# ---------------------------------------------------------------------------
rel = "packages/server/src/routes/generate.routes.ts"
text = read(rel)

if "  buildReferencedCharacterContext,\n" not in text:
    text = replace_once(
        text,
        "  buildPromptMacroContext,\n",
        "  buildPromptMacroContext,\n  buildReferencedCharacterContext,\n",
        "generate referenced-character import",
    )

loader_import = 'import { loadCharacterPromptInfo } from "../services/generation/character-prompt-context.js";\n'
if "loadCharacterPromptInfo" not in text:
    import_anchor = 'import { textRewriteDropsProtectedMarkup } from "../services/generation/text-rewrite-safety.js";\n'
    text = replace_once(
        text,
        import_anchor,
        import_anchor + loader_import,
        "character prompt loader import",
    )

# Migrate the previous implementation, where ID resolution happened only after
# prompt assembly. Remove that inline resolver if present; the request-scoped card
# injection block below will reuse the early IDs instead.
legacy_inline_identity = '''        const trackerCarryForwardCharacterIds: string[] = [];
        const trackerPresentCharacters = Array.isArray(gameState?.presentCharacters)
          ? gameState.presentCharacters
          : [];

        for (const present of trackerPresentCharacters) {
          const candidateId = typeof present.characterId === "string" ? present.characterId.trim() : "";
          if (!candidateId || trackerCarryForwardCharacterIds.includes(candidateId)) continue;
          if (await chars.getById(candidateId)) trackerCarryForwardCharacterIds.push(candidateId);
        }

'''
if legacy_inline_identity in text:
    text = replace_once(text, legacy_inline_identity, "", "remove late carry-forward identity resolver")

# Resolve canonical carried IDs before semantic lore discovery and prompt assembly.
early_ids_block = '''        // CHARACTER_LORE_EFFECTIVE_IDS_V1
        // Lorebook character filters must see canonical Character Card IDs from the
        // anchored prior Tracker state before the normal World Lore scan runs.
        const trackerCarryForwardCharacterIds: string[] = [];
        const trackerPresentCharactersForLore = Array.isArray(gameState?.presentCharacters)
          ? gameState.presentCharacters
          : [];
        for (const present of trackerPresentCharactersForLore) {
          const candidateId = typeof present.characterId === "string" ? present.characterId.trim() : "";
          if (!candidateId || trackerCarryForwardCharacterIds.includes(candidateId)) continue;
          if (await chars.getById(candidateId)) trackerCarryForwardCharacterIds.push(candidateId);
        }
        const effectiveLorebookCharacterIds = Array.from(
          new Set([...promptCharacterIds, ...trackerCarryForwardCharacterIds]),
        );

'''
embedding_anchor = "        // ── Compute chat embedding for semantic lorebook matching (if any entries are vectorized) ──\n"
if LORE_IDS_MARKER not in text:
    text = replace_once(text, embedding_anchor, early_ids_block + embedding_anchor, "early lore character ids")

# Feed the expanded request-scoped set to scope discovery and the preset lore marker,
# without changing the roster/card IDs used for speaker and macro semantics.
text = text.replace(
    "          const lorebookScopeFilters = {\n            chatId: input.chatId,\n            characterIds: promptCharacterIds,\n",
    "          const lorebookScopeFilters = {\n            chatId: input.chatId,\n            characterIds: effectiveLorebookCharacterIds,\n",
    1,
)
assembler_anchor = "            characterIds: promptCharacterIds,\n            groupCharacterIds: characterIds,\n"
if "            lorebookCharacterIds: effectiveLorebookCharacterIds,\n" not in text:
    text = replace_once(
        text,
        assembler_anchor,
        "            characterIds: promptCharacterIds,\n            lorebookCharacterIds: effectiveLorebookCharacterIds,\n            groupCharacterIds: characterIds,\n",
        "assembler effective lore character ids",
    )

# Keep Knowledge Router's entry filters consistent with the ordinary lore scan.
text = text.replace("        const promptCharacterIdSet = new Set(promptCharacterIds);\n", "        const promptCharacterIdSet = new Set(effectiveLorebookCharacterIds);\n", 1)
text = text.replace("                      activeCharacterIds: promptCharacterIds,\n", "                      activeCharacterIds: effectiveLorebookCharacterIds,\n", 1)
text = text.replace("                        activeCharacterIds: promptCharacterIds,\n", "                        activeCharacterIds: effectiveLorebookCharacterIds,\n", 1)

# Older versions accidentally placed the card injection block inside the optional
# pre-generation/KR/Router gate. Remove that legacy placement structurally first.
legacy_marker = "          // CHARACTER_LORE_CARRY_FORWARD_V1\n"
legacy_end_anchor = "          for (const result of preGenResults) {\n"
if legacy_marker in text:
    start = text.index(legacy_marker)
    try:
        end = text.index(legacy_end_anchor, start)
    except ValueError as exc:
        raise SystemExit("legacy carry-forward relocation: end anchor not found") from exc
    text = text[:start] + text[end:]

carry_forward = '''        // CHARACTER_LORE_CARRY_FORWARD_V1
        // Preserve the deterministic Character Card context half of Character
        // Activation Runtime. Identity resolution already ran before lore assembly.
        // This remains request-scoped and does not mutate Chat Settings -> Characters.
        if (trackerCarryForwardCharacterIds.length > 0) {
          const activeCharacterInfo = await loadCharacterPromptInfo({
            chars,
            characterIds: trackerCarryForwardCharacterIds,
            chatMode,
          });

          const knownAgentCharacterIds = new Set(agentContext.characters.map((character) => character.id));
          for (const character of activeCharacterInfo) {
            if (knownAgentCharacterIds.has(character.id)) continue;
            agentContext.characters.push(character);
            knownAgentCharacterIds.add(character.id);
          }

          const carriedContext = await buildReferencedCharacterContext({
            db: app.db,
            activeCharacterIds: promptCharacterIds,
            sources: trackerCarryForwardCharacterIds.map((characterId) => `{{${characterId}}}`),
            chatMessages: toLorebookScanMessages(),
            macroCtx: promptMacroContext,
            wrapFormat,
            chatId: input.chatId,
            gameState: gameState as Record<string, unknown> | null,
            generationTriggers: lorebookGenerationTriggers,
            excludedLorebookIds: lorebookScopeExclusions.excludedLorebookIds,
            excludedLorebookSourceAgentIds: lorebookScopeExclusions.excludedSourceAgentIds,
          });

          if (carriedContext.content.trim()) {
            agentContext.memory._activatedCharacterContext = carriedContext.content;
            finalMessages = injectAtDepth(finalMessages, [
              { content: carriedContext.content, role: "system", depth: 0 },
            ]);
          }

          agentContext.memory._activeCharacterCardIds = trackerCarryForwardCharacterIds;
          logger.info(
            "[character-lore-carry-forward] Activated %d canonical Tracker Character Card(s): %s",
            trackerCarryForwardCharacterIds.length,
            trackerCarryForwardCharacterIds.join(", "),
          );
        }

'''

pregen_gate_anchor = "        if (shouldRunDirectorSecretPlot || shouldRunPreGen || shouldRunKR || shouldRunRouter) {\n"
if MARKER not in text:
    text = replace_once(
        text,
        pregen_gate_anchor,
        carry_forward + pregen_gate_anchor,
        "unconditional carry-forward placement",
    )
else:
    marker_index = text.index(MARKER)
    gate_index = text.index(pregen_gate_anchor)
    if marker_index > gate_index:
        raise SystemExit("carry-forward placement: marker is still nested behind the optional pre-generation gate")

write(rel, text)

# ---------------------------------------------------------------------------
# 4. Character Tracker receives the same canonical card context block.
# ---------------------------------------------------------------------------
rel = "packages/server/src/services/agents/agent-executor.ts"
text = read(rel)
if MARKER not in text:
    extras_anchor = '''  const parts: string[] = [];

  // Card Evolution Auditor needs the FULL character card (not just description)
'''
    extras_replacement = '''  const parts: string[] = [];

  // CHARACTER_LORE_CARRY_FORWARD_V1
  // Character Tracker must see the same request-scoped canonical Character Card
  // baseline that the main model received.
  if (agentTypes.includes("character-tracker")) {
    const activatedCharacterContext =
      typeof context.memory._activatedCharacterContext === "string"
        ? context.memory._activatedCharacterContext.trim()
        : "";
    if (activatedCharacterContext) {
      parts.push(`<activated_character_context>`);
      parts.push(
        `These are existing canonical Character Cards carried forward from the anchored prior Character Tracker state. Use their exact character_id values and treat their card fields and attached lore as the baseline. Infer only scene-dependent changes.`,
      );
      parts.push(activatedCharacterContext);
      parts.push(`</activated_character_context>`);
    }
  }

  // Card Evolution Auditor needs the FULL character card (not just description)
'''
    text = replace_once(text, extras_anchor, extras_replacement, "tracker activated-character context")
    write(rel, text)

print("Character Lore carry-forward restoration applied successfully.")
print("Next: run the regression script and the normal TypeScript/build checks.")