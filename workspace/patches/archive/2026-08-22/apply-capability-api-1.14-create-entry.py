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

changes = {}

rel = "packages/shared/src/types/capability-runtime.ts"
text = read(rel)

old = '''  createLorebook?(input: CapabilityLorebookCreateInput): Promise<CapabilityLorebookRecord>;
  updateLorebook?(lorebookId: string, updates: CapabilityLorebookUpdateInput): Promise<void>;
  bulkCreateLorebookEntries?(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void>;
  updateLorebookEntry?(entryId: string, updates: CapabilityLorebookEntryUpdateInput): Promise<void>;
  removeLorebookEntry?(entryId: string): Promise<void>;
'''
new = '''  createLorebook?(input: CapabilityLorebookCreateInput): Promise<CapabilityLorebookRecord>;
  updateLorebook?(lorebookId: string, updates: CapabilityLorebookUpdateInput): Promise<void>;
  createLorebookEntry?(
    lorebookId: string,
    entry: CapabilityLorebookEntryInput,
  ): Promise<CapabilityLorebookEntryRecord>;
  bulkCreateLorebookEntries?(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void>;
  updateLorebookEntry?(entryId: string, updates: CapabilityLorebookEntryUpdateInput): Promise<void>;
  removeLorebookEntry?(entryId: string): Promise<void>;
'''
text = replace_once(text, old, new, f"{rel}: createLorebookEntry contract")
changes[rel] = text

rel = "packages/server/src/services/capability-packages/capability-resources.service.ts"
text = read(rel)

old = '''    async bulkCreateLorebookEntries(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void> {
      await lorebooks.bulkCreateEntries(lorebookId, entries);
    },

    async updateLorebookEntry(entryId: string, updates: CapabilityLorebookEntryUpdateInput): Promise<void> {
      await lorebooks.updateEntry(entryId, updates);
    },
'''
new = '''    async createLorebookEntry(
      lorebookId: string,
      entry: CapabilityLorebookEntryInput,
    ): Promise<CapabilityLorebookEntryRecord> {
      const record = await lorebooks.createEntry({ ...entry, lorebookId });
      if (!record) throw new Error("[capability] createLorebookEntry failed");
      const books = (await lorebooks.list()) as unknown as Array<{ id: string; name: string }>;
      const lorebookName = books.find((book) => book.id === record.lorebookId)?.name ?? "Unknown lorebook";
      return {
        id: record.id,
        lorebookId: record.lorebookId,
        lorebookName,
        name: record.name,
        content: record.content,
        description: record.description,
      };
    },

    async bulkCreateLorebookEntries(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void> {
      await lorebooks.bulkCreateEntries(lorebookId, entries);
    },

    async updateLorebookEntry(entryId: string, updates: CapabilityLorebookEntryUpdateInput): Promise<void> {
      await lorebooks.updateEntry(entryId, updates);
    },
'''
text = replace_once(text, old, new, f"{rel}: createLorebookEntry implementation")
changes[rel] = text

rel = "scripts/regressions/capability-lorebook-entry-write.regression.ts"
if (ROOT / rel).exists():
    raise SystemExit(f"[FAIL] {rel} already exists")

changes[rel] = '''import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-capability-lorebook-entry-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

let app: {
  close(): Promise<void>;
  ready(): Promise<void>;
} | null = null;

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { getDB } = await import("../../packages/server/src/db/connection.js");
  const { createCapabilityResourceHost } = await import(
    "../../packages/server/src/services/capability-packages/capability-resources.service.js"
  );

  app = await buildApp();
  await app.ready();

  const db = await getDB();
  const resources = createCapabilityResourceHost(db);

  assert.equal(typeof resources.createLorebook, "function");
  assert.equal(
    typeof resources.createLorebookEntry,
    "function",
    "Capability API 1.14 must return the created lorebook entry identity",
  );
  assert.equal(typeof resources.updateLorebookEntry, "function");

  const lorebook = await resources.createLorebook!({
    name: "Character Lore Sync regression",
    description: "Capability API 1.14 entry identity regression.",
    category: "world",
    enabled: true,
  });

  const created = await resources.createLorebookEntry!(lorebook.id, {
    name: "Eva Green - Current Outfit",
    content: "Eva Green is currently wearing: Black corset dress with lace gloves.",
    keys: ["Eva Green"],
    description: "Managed by Character Lore Sync.",
  });

  assert.ok(created.id, "created entry must expose its durable id");
  assert.equal(created.lorebookId, lorebook.id);
  assert.equal(created.lorebookName, "Character Lore Sync regression");
  assert.equal(created.name, "Eva Green - Current Outfit");
  assert.match(created.content, /Black corset dress/);

  await resources.updateLorebookEntry!(created.id, {
    content: "Eva Green is currently wearing: White silk blouse with black trousers.",
    keys: ["Eva Green"],
  });

  const [updated] = await resources.listEligibleLorebookEntries({
    lorebookIds: [],
    entryIds: [created.id],
  });

  assert.ok(updated, "created entry must remain addressable by the returned id");
  assert.equal(updated.id, created.id);
  assert.equal(updated.lorebookId, lorebook.id);
  assert.equal(
    updated.content,
    "Eva Green is currently wearing: White silk blouse with black trousers.",
    "the same durable entry id must be updated in place",
  );

  console.info("Capability lorebook entry write regression passed.");
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}
'''

for rel, content in changes.items():
    (ROOT / rel).write_text(content)

print("[OK] createLorebookEntry Capability API 1.14 extension applied.")
print("[NEXT]")
print("  git diff --check")
print("  docker build --target builder -t marinara-engine-check .")
print("  # then run capability-lorebook-entry-write.regression.ts")
