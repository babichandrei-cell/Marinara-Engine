#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.cwd()

def read(rel: str) -> str:
    p = ROOT / rel
    if not p.exists():
        raise SystemExit(f"[FAIL] Missing file: {rel}")
    return p.read_text()

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[FAIL] {label}: expected anchor exactly once, found {count}")
    return text.replace(old, new, 1)

rel = "packages/server/src/services/capability-packages/capability-resources.service.ts"
s = read(rel)

anchor = '''import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
'''
replacement = '''import { createLorebooksStorage } from "../storage/lorebooks.storage.js";
import { syncCharacterBookFromLorebook } from "../lorebook/character-book-sync.js";
'''
s = replace_once(s, anchor, replacement, f"{rel}: sync helper import")

old = '''      if (!record) {
        throw new Error("[capability] createLorebookEntry failed");
      }
      const books = (await lorebooks.list()) as unknown as Array<{ id: string; name: string }>;
'''
new = '''      if (!record) {
        throw new Error("[capability] createLorebookEntry failed");
      }
      await syncCharacterBookFromLorebook(db, record.lorebookId);
      const books = (await lorebooks.list()) as unknown as Array<{ id: string; name: string }>;
'''
s = replace_once(s, old, new, f"{rel}: create entry mirror")

old = '''    async bulkCreateLorebookEntries(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void> {
      await lorebooks.bulkCreateEntries(lorebookId, entries);
    },
'''
new = '''    async bulkCreateLorebookEntries(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void> {
      await lorebooks.bulkCreateEntries(lorebookId, entries);
      await syncCharacterBookFromLorebook(db, lorebookId);
    },
'''
s = replace_once(s, old, new, f"{rel}: bulk create mirror")

old = '''    async updateLorebookEntry(entryId: string, updates: CapabilityLorebookEntryUpdateInput): Promise<void> {
      await lorebooks.updateEntry(entryId, updates);
    },
'''
new = '''    async updateLorebookEntry(entryId: string, updates: CapabilityLorebookEntryUpdateInput): Promise<void> {
      const existing = (await lorebooks.getEntry(entryId)) as unknown as LorebookEntrySource | null;
      await lorebooks.updateEntry(entryId, updates);
      if (existing?.lorebookId) {
        await syncCharacterBookFromLorebook(db, existing.lorebookId);
      }
    },
'''
s = replace_once(s, old, new, f"{rel}: update entry mirror")

old = '''    async removeLorebookEntry(entryId: string): Promise<void> {
      await lorebooks.removeEntry(entryId);
    },
'''
new = '''    async removeLorebookEntry(entryId: string): Promise<void> {
      const existing = (await lorebooks.getEntry(entryId)) as unknown as LorebookEntrySource | null;
      await lorebooks.removeEntry(entryId);
      if (existing?.lorebookId) {
        await syncCharacterBookFromLorebook(db, existing.lorebookId);
      }
    },
'''
s = replace_once(s, old, new, f"{rel}: remove entry mirror")

(ROOT / rel).write_text(s)

reg = ROOT / "scripts/regressions/capability-embedded-lorebook-sync.regression.ts"
if reg.exists():
    raise SystemExit(f"[FAIL] {reg} already exists")

reg.write_text('''import assert from "node:assert/strict";
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
  /import \\{ syncCharacterBookFromLorebook \\} from "\\.\\.\\/lorebook\\/character-book-sync\\.js";/,
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
    /syncCharacterBookFromLorebook\\(db,/,
    `${marker} must mirror embedded Character Book state`,
  );
}

assert.match(
  source,
  /async updateLorebookEntry[\\s\\S]*?lorebooks\\.getEntry\\(entryId\\)[\\s\\S]*?lorebooks\\.updateEntry\\(entryId, updates\\)[\\s\\S]*?syncCharacterBookFromLorebook\\(db, existing\\.lorebookId\\)/,
);

assert.match(
  source,
  /async removeLorebookEntry[\\s\\S]*?lorebooks\\.getEntry\\(entryId\\)[\\s\\S]*?lorebooks\\.removeEntry\\(entryId\\)[\\s\\S]*?syncCharacterBookFromLorebook\\(db, existing\\.lorebookId\\)/,
);

console.info("Capability embedded Character Lorebook sync regression passed.");
''')

print("[OK] Capability Lorebook writes now mirror embedded Character Books.")
print("[NEXT]")
print("  git diff --check")
print("  docker build --target builder -t marinara-engine-check .")
