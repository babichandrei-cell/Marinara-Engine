import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

const source = await readFile(
  resolve(
    root,
    "packages/server/src/services/capability-packages/capability-resources.service.ts",
  ),
  "utf8",
);

assert.match(
  source,
  /import \{ syncCharacterBookFromLorebook \} from "\.\.\/lorebook\/character-book-sync\.js";/,
);

for (const marker of [
  "createLorebookEntry",
  "bulkCreateLorebookEntries",
  "updateLorebookEntry",
  "removeLorebookEntry",
]) {
  const index = source.indexOf(`async ${marker}`);
  assert.notEqual(index, -1, `${marker} must exist`);
  const tail = source.slice(index, index + 1300);
  assert.match(
    tail,
    /syncCharacterBookFromLorebook\(db,/,
    `${marker} must mirror embedded Character Book state`,
  );
}

assert.match(
  source,
  /async updateLorebookEntry[\s\S]*?lorebooks\.getEntry\(entryId\)[\s\S]*?lorebooks\.updateEntry\(entryId, updates\)[\s\S]*?syncCharacterBookFromLorebook\(db, existing\.lorebookId\)/,
);

assert.match(
  source,
  /async removeLorebookEntry[\s\S]*?lorebooks\.getEntry\(entryId\)[\s\S]*?lorebooks\.removeEntry\(entryId\)[\s\S]*?syncCharacterBookFromLorebook\(db, existing\.lorebookId\)/,
);

console.info("Capability embedded Character Lorebook sync regression passed.");
