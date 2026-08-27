#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.cwd()

def read(rel):
    p = ROOT / rel
    if not p.exists():
        raise SystemExit(f"[FAIL] Missing file: {rel}")
    return p.read_text()

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[FAIL] {label}: expected anchor exactly once, found {count}")
    return text.replace(old, new, 1)

rel = "packages/client/src/hooks/use-generate.ts"
s = read(rel)

old = '''        if (shouldRefreshGameState) {
          // Refresh game state from DB so HUD/sidebar trackers settle on the
          // persisted active-swipe row after generation-time SSE patches.
          await refreshVisibleGameStateAfterGeneration(params.chatId);
        }
        if (isGameGeneration && sawDoneEvent && receivedContent) {
'''

new = '''        if (shouldRefreshGameState) {
          // Refresh game state from DB so HUD/sidebar trackers settle on the
          // persisted active-swipe row after generation-time SSE patches.
          await refreshVisibleGameStateAfterGeneration(params.chatId);
        }

        // Capability packages can mutate character-linked Lorebooks after the
        // agent pipeline settles. The server mirrors embedded Character Books,
        // but React Query can still hold a five-minute character-detail
        // snapshot. Reconcile the affected character resources only after the
        // generation has fully settled so Character Editor immediately sees
        // tracker-driven Lore changes without a manual embedded-lorebook refresh.
        if (chatModeForGeneration === "roleplay" || chatModeForGeneration === "game") {
          const activeChatForResourceRefresh =
            useChatStore.getState().activeChat?.id === params.chatId
              ? useChatStore.getState().activeChat
              : null;
          const cachedChatForResourceRefresh =
            qc.getQueryData<Chat[]>(chatKeys.list())?.find((item) => item.id === params.chatId) ?? null;
          const chatForResourceRefresh = activeChatForResourceRefresh ?? cachedChatForResourceRefresh;
          const characterIdsForResourceRefresh = parseChatCharacterIds(chatForResourceRefresh?.characterIds);

          for (const characterId of characterIdsForResourceRefresh) {
            void qc.invalidateQueries({
              queryKey: characterKeys.detail(characterId),
              exact: true,
              refetchType: "active",
            });
          }
          void qc.invalidateQueries({
            queryKey: characterKeys.list(),
            refetchType: "active",
          });
          void qc.invalidateQueries({
            queryKey: lorebookKeys.active(params.chatId),
            refetchType: "active",
          });
        }

        if (isGameGeneration && sawDoneEvent && receivedContent) {
'''

s = replace_once(s, old, new, f"{rel}: post-generation character resource refresh")
(ROOT / rel).write_text(s)

reg = ROOT / "scripts/regressions/post-generation-character-resource-refresh.regression.ts"
if reg.exists():
    raise SystemExit(f"[FAIL] {reg} already exists")

reg.write_text('''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

const source = await readFile(
  resolve(root, "packages/client/src/hooks/use-generate.ts"),
  "utf8",
);

const marker = "Capability packages can mutate character-linked Lorebooks after the";
const index = source.indexOf(marker);

assert.notEqual(index, -1);

const block = source.slice(Math.max(0, index - 900), index + 3200);

assert.match(block, /await refreshVisibleGameStateAfterGeneration\\(params\\.chatId\\);/);
assert.match(block, /parseChatCharacterIds\\(chatForResourceRefresh\\?\\.characterIds\\)/);
assert.match(block, /characterKeys\\.detail\\(characterId\\)/);
assert.match(block, /exact: true,[\\s\\S]*?refetchType: "active"/);
assert.match(block, /characterKeys\\.list\\(\\)/);
assert.match(block, /lorebookKeys\\.active\\(params\\.chatId\\)/);

console.info("Post-generation Character resource refresh regression passed.");
''')

print("[OK] Post-generation Character/Lore cache reconciliation applied.")
print("[NEXT]")
print("  git diff --check")
print("  docker build --target builder -t marinara-engine-check .")
