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

changes = {}

rel = "packages/shared/src/types/capability-runtime.ts"
s = read(rel)

old = '''export interface CapabilityLorebookCreateInput {
  name: string;
  description?: string;
  category?: CapabilityLorebookCategory;
  scanDepth?: number;
  tokenBudget?: number;
  personaId?: string;
  enabled?: boolean;
}
/** The retrieval knobs a package may retune on a lorebook it owns. */
export interface CapabilityLorebookUpdateInput {
  scanDepth?: number;
  tokenBudget?: number;
}
'''
new = '''export interface CapabilityLorebookCreateInput {
  name: string;
  description?: string;
  category?: CapabilityLorebookCategory;
  scanDepth?: number;
  tokenBudget?: number;
  personaId?: string;
  /** Bind the lorebook to one Character card. */
  characterId?: string;
  /** Bind the lorebook to multiple Character cards. */
  characterIds?: string[];
  enabled?: boolean;
}
/** The retrieval/ownership knobs a package may retune on a lorebook it owns. */
export interface CapabilityLorebookUpdateInput {
  scanDepth?: number;
  tokenBudget?: number;
  /** Replace Character ownership with one Character card. */
  characterId?: string;
  /** Replace Character ownership with these Character cards. */
  characterIds?: string[];
}
'''
s = replace_once(s, old, new, f"{rel}: lorebook ownership types")

old = '''  thoughts?: string;
  stats?: unknown[];
  avatarPath?: string;
  avatarCrop?: unknown;
}
'''
new = '''  thoughts?: string;
  /** Tracker-defined structured state such as Role, ClientStatus, occupation, etc. */
  customFields?: Record<string, unknown>;
  stats?: unknown[];
  avatarPath?: string;
  avatarCrop?: unknown;
}
'''
s = replace_once(s, old, new, f"{rel}: tracker customFields type")
changes[rel] = s

rel = "packages/server/src/services/capability-packages/capability-persistence.service.ts"
s = read(rel)

old = '''        ...(typeof record.thoughts === "string" ? { thoughts: record.thoughts } : {}),
        ...(Array.isArray(record.stats) ? { stats: record.stats } : {}),
'''
new = '''        ...(typeof record.thoughts === "string" ? { thoughts: record.thoughts } : {}),
        ...(record.customFields &&
        typeof record.customFields === "object" &&
        !Array.isArray(record.customFields)
          ? { customFields: record.customFields as Record<string, unknown> }
          : {}),
        ...(Array.isArray(record.stats) ? { stats: record.stats } : {}),
'''
s = replace_once(s, old, new, f"{rel}: tracker customFields parser")
changes[rel] = s

rel = "scripts/regressions/capability-character-lore-contract.regression.ts"
if (ROOT / rel).exists():
    raise SystemExit(f"[FAIL] {rel} already exists")

changes[rel] = '''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

const runtimeTypes = await readFile(
  resolve(root, "packages/shared/src/types/capability-runtime.ts"),
  "utf8",
);
const persistence = await readFile(
  resolve(root, "packages/server/src/services/capability-packages/capability-persistence.service.ts"),
  "utf8",
);

assert.match(
  runtimeTypes,
  /interface CapabilityTrackedCharacterRecord[\\s\\S]*customFields\\?: Record<string, unknown>/,
);
assert.match(
  runtimeTypes,
  /interface CapabilityLorebookCreateInput[\\s\\S]*characterId\\?: string;[\\s\\S]*characterIds\\?: string\\[\\]/,
);
assert.match(
  runtimeTypes,
  /interface CapabilityLorebookUpdateInput[\\s\\S]*characterId\\?: string;[\\s\\S]*characterIds\\?: string\\[\\]/,
);
assert.match(
  persistence,
  /record\\.customFields[\\s\\S]*customFields: record\\.customFields as Record<string, unknown>/,
);

console.info("Capability Character/Lore contract regression passed.");
'''

for rel, text in changes.items():
    (ROOT / rel).write_text(text)

print("[OK] Capability API 1.14 Character Lore ownership + Tracker customFields applied.")
print("[NEXT]")
print("  git diff --check")
print("  docker build --target builder -t marinara-engine-check .")
