import assert from "node:assert/strict";
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

assert.match(block, /await refreshVisibleGameStateAfterGeneration\(params\.chatId\);/);
assert.match(block, /parseChatCharacterIds\(chatForResourceRefresh\?\.characterIds\)/);
assert.match(block, /characterKeys\.detail\(characterId\)/);
assert.match(block, /exact: true,[\s\S]*?refetchType: "active"/);
assert.match(block, /characterKeys\.list\(\)/);
assert.match(block, /lorebookKeys\.active\(params\.chatId\)/);

console.info("Post-generation Character resource refresh regression passed.");
