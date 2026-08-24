import assert from "node:assert/strict";
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
