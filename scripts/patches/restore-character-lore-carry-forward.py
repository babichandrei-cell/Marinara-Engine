#!/usr/bin/env python3
"""Restore canonical Tracker -> request-scoped Character Card/Lore carry-forward.

This is intentionally a small, fail-fast patcher. It restores only the deterministic
part of the previously tested Character Activation Runtime:

1. Canonical Character Tracker presentCharacters IDs from the anchored prior state
   are resolved against Character storage.
2. Matching Character Cards are loaded request-scoped without mutating chat.characterIds.
3. Marinara's existing buildReferencedCharacterContext() attaches the card and its
   Character-linked Lore to the main prompt.
4. Character Tracker receives the same canonical card/lore baseline.
5. Illustrator ordering/current-turn Tracker handling is untouched.

The older LLM Character Router and Missing Character Recovery are deliberately NOT
restored by this patch.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path.cwd()
MARKER = "CHARACTER_LORE_CARRY_FORWARD_V1"


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
# 2. Main generation runtime: deterministic canonical Tracker carry-forward.
# ---------------------------------------------------------------------------
rel = "packages/server/src/routes/generate.routes.ts"
text = read(rel)
if MARKER not in text:
    # Import the existing builder through the prompt service.
    if "  buildReferencedCharacterContext,\n" not in text:
        text = replace_once(
            text,
            "  buildPromptMacroContext,\n",
            "  buildPromptMacroContext,\n  buildReferencedCharacterContext,\n",
            "generate referenced-character import",
        )

    # Reuse the normal Character Card prompt loader.
    loader_import = 'import { loadCharacterPromptInfo } from "../services/generation/character-prompt-context.js";\n'
    if loader_import not in text:
        import_anchor = 'import { textRewriteDropsProtectedMarkup } from "../services/generation/text-rewrite-safety.js";\n'
        text = replace_once(
            text,
            import_anchor,
            import_anchor + loader_import,
            "character prompt loader import",
        )

    pregen_anchor = '''          for (const result of preGenResults) {
            if (!result.success || result.type !== "prompt_patch") continue;
'''
    carry_forward = '''          // CHARACTER_LORE_CARRY_FORWARD_V1
          // Preserve the tested deterministic half of Character Activation Runtime:
          // canonical Character Card IDs already present in the anchored Character
          // Tracker state remain request-scoped active for this generation. This does
          // NOT mutate Chat Settings -> Characters and does not run another LLM.
          const trackerCarryForwardCharacterIds: string[] = [];
          const trackerPresentCharacters = Array.isArray(gameState?.presentCharacters)
            ? gameState.presentCharacters
            : [];

          for (const present of trackerPresentCharacters) {
            const candidateId =
              present &&
              typeof present === "object" &&
              typeof (present as Record<string, unknown>).characterId === "string"
                ? ((present as Record<string, unknown>).characterId as string).trim()
                : "";
            if (!candidateId || trackerCarryForwardCharacterIds.includes(candidateId)) continue;
            if (await chars.getById(candidateId)) trackerCarryForwardCharacterIds.push(candidateId);
          }

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

''' + pregen_anchor
    text = replace_once(text, pregen_anchor, carry_forward, "pre-generation carry-forward")
    write(rel, text)

# ---------------------------------------------------------------------------
# 3. Character Tracker receives the same canonical card + attached lore block.
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
  // and attached Character Lore baseline that the main model received.
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
