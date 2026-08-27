#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.cwd()

def read(rel):
    p = ROOT / rel
    if not p.exists():
        raise SystemExit(f"[FAIL] Missing file: {rel}")
    return p.read_text()

def write(rel, text):
    (ROOT / rel).write_text(text)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[FAIL] {label}: expected anchor exactly once, found {count}")
    return text.replace(old, new, 1)

def insert_before_once(text, anchor, insertion, label):
    count = text.count(anchor)
    if count != 1:
        raise SystemExit(f"[FAIL] {label}: expected anchor exactly once, found {count}")
    return text.replace(anchor, insertion + anchor, 1)

changes = {}

rel = "packages/shared/src/types/capability-runtime.ts"
text = read(rel)

old = '''export interface CapabilityLorebookEntryInput {
  /** Required: an entry with no name cannot be stored, so accepting one here only defers the failure. */
  name: string;
  content?: string;
  keys?: string[];
  [key: string]: unknown;
}
'''
new = old + '''
/** Narrow update surface for an existing lorebook entry. */
export interface CapabilityLorebookEntryUpdateInput {
  name?: string;
  content?: string;
  description?: string;
  keys?: string[];
  secondaryKeys?: string[];
}

/** One authoritative Character Tracker entry persisted for a message/swipe anchor. */
export interface CapabilityTrackedCharacterRecord {
  characterId: string;
  name: string;
  emoji?: string;
  mood?: string;
  appearance?: string;
  outfit?: string;
  thoughts?: string;
  stats?: unknown[];
  avatarPath?: string;
  avatarCrop?: unknown;
}
'''
text = replace_once(text, old, new, f"{rel}: tracker/update types")

old = '''  bulkCreateLorebookEntries?(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void>;
  removeLorebookEntry?(entryId: string): Promise<void>;
'''
new = '''  bulkCreateLorebookEntries?(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void>;
  updateLorebookEntry?(entryId: string, updates: CapabilityLorebookEntryUpdateInput): Promise<void>;
  removeLorebookEntry?(entryId: string): Promise<void>;
'''
text = replace_once(text, old, new, f"{rel}: resource update method")

old = '''  /** Read-only. Optional so packages feature-detect and degrade on older Engines. */
  getGameState?(chatId: string): Promise<CapabilityGameStateRecord | null>;
  appendRoleplayEvent?(input: CapabilityRoleplayEventInput): Promise<CapabilityRoleplayEventRecord | null>;
'''
new = '''  /** Read-only. Optional so packages feature-detect and degrade on older Engines. */
  getGameState?(chatId: string): Promise<CapabilityGameStateRecord | null>;
  /**
   * Read authoritative Character Tracker state for one persisted message/swipe
   * anchor so overlapping Roleplay generations cannot observe a newer turn.
   */
  getCharacterTrackerState?(
    chatId: string,
    messageId: string,
    swipeIndex: number,
  ): Promise<CapabilityTrackedCharacterRecord[]>;
  appendRoleplayEvent?(input: CapabilityRoleplayEventInput): Promise<CapabilityRoleplayEventRecord | null>;
'''
text = replace_once(text, old, new, f"{rel}: tracker read method")

old = '''export interface CapabilityRuntimeHost {
  embeddings: CapabilityEmbeddingHost;
  getAgentConfig(): Promise<{ connectionId: string | null; settings: Record<string, unknown> } | null>;
  isDebugAgentsEnabled(): boolean;
  json: CapabilityJsonHost;
  languageModels: CapabilityLanguageModelHost;
  logger: CapabilityRuntimeLogger;
  persistence: CapabilityPersistenceHost;
  resources: CapabilityResourceHost;
}
'''
new = old + '''
/** Fired after ordinary post-processing results for an anchor are finalized and durably applied. */
export interface CapabilityAgentPipelineSettledEvent {
  chatId: string;
  generationId: string;
  messageId: string;
  swipeIndex: number;
}

export type CapabilityAgentPipelineSettledHandler = (
  event: CapabilityAgentPipelineSettledEvent,
) => void | Promise<void>;
'''
text = replace_once(text, old, new, f"{rel}: lifecycle types")
changes[rel] = text

rel = "packages/shared/src/schemas/capability-package.schema.ts"
text = read(rel)
old = '''// 1.13: setExperienceChrome accepts requestsCollapsedNarration — a transient request
//        to fold the Game narration box down to its handle for a cutscene beat. It
//        never writes the player's stored preference and the engine's safety rules
//        still force the box open when it holds something to act on.
export const supportedCapabilityApi = Object.freeze({ major: 1, minor: 13 } as const);
'''
new = '''// 1.13: setExperienceChrome accepts requestsCollapsedNarration — a transient request
//        to fold the Game narration box down to its handle for a cutscene beat. It
//        never writes the player's stored preference and the engine's safety rules
//        still force the box open when it holds something to act on.
// 1.14: server runtimes may subscribe to the post-persistence agent pipeline
//        lifecycle; persistence exposes anchored Character Tracker reads; and
//        resources expose in-place lorebook entry updates.
export const supportedCapabilityApi = Object.freeze({ major: 1, minor: 14 } as const);
'''
text = replace_once(text, old, new, f"{rel}: API version")
changes[rel] = text

rel = "packages/server/src/services/capability-packages/capability-agent-lifecycle.service.ts"
if (ROOT / rel).exists():
    raise SystemExit(f"[FAIL] {rel} already exists")
changes[rel] = '''import type {
  CapabilityAgentPipelineSettledEvent,
  CapabilityAgentPipelineSettledHandler,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";

type Cleanup = () => void;

const agentPipelineSettledHandlers = new Set<CapabilityAgentPipelineSettledHandler>();

export function registerCapabilityAgentPipelineSettledHandler(
  handler: CapabilityAgentPipelineSettledHandler,
): Cleanup {
  agentPipelineSettledHandlers.add(handler);
  return () => {
    agentPipelineSettledHandlers.delete(handler);
  };
}

export async function dispatchCapabilityAgentPipelineSettled(
  event: CapabilityAgentPipelineSettledEvent,
): Promise<void> {
  const outcomes = await Promise.allSettled(
    [...agentPipelineSettledHandlers].map((handler) => handler(event)),
  );
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      logger.warn(outcome.reason, "[capability] agent pipeline settled handler failed");
    }
  }
}

export function resetCapabilityAgentPipelineSettledHandlers(): void {
  agentPipelineSettledHandlers.clear();
}
'''

rel = "packages/server/src/services/capability-packages/capability-persistence.service.ts"
text = read(rel)
text = replace_once(text, '''  type CapabilityGameStateRecord,
''', '''  type CapabilityGameStateRecord,
  type CapabilityTrackedCharacterRecord,
''', f"{rel}: import tracked type")

text = insert_before_once(text, '''function mapGameState(row: typeof gameStateSnapshots.$inferSelect): CapabilityGameStateRecord {
''', '''function parseTrackedCharacters(value: unknown): CapabilityTrackedCharacterRecord[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const record = entry as Record<string, unknown>;
      const characterId =
        typeof record.characterId === "string"
          ? record.characterId.trim()
          : typeof record.id === "string"
            ? record.id.trim()
            : "";
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!characterId || !name) return [];

      return [{
        characterId,
        name,
        ...(typeof record.emoji === "string" ? { emoji: record.emoji } : {}),
        ...(typeof record.mood === "string" ? { mood: record.mood } : {}),
        ...(typeof record.appearance === "string" ? { appearance: record.appearance } : {}),
        ...(typeof record.outfit === "string" ? { outfit: record.outfit } : {}),
        ...(typeof record.thoughts === "string" ? { thoughts: record.thoughts } : {}),
        ...(Array.isArray(record.stats) ? { stats: record.stats } : {}),
        ...(typeof record.avatarPath === "string" ? { avatarPath: record.avatarPath } : {}),
        ...(record.avatarCrop !== undefined ? { avatarCrop: record.avatarCrop } : {}),
      }];
    });
  } catch {
    return [];
  }
}

''', f"{rel}: parser insertion")

text = replace_once(text, '''    async appendRoleplayEvent(input: CapabilityRoleplayEventInput): Promise<CapabilityRoleplayEventRecord | null> {
''', '''    async getCharacterTrackerState(chatId, messageId, swipeIndex) {
      const rows = await db
        .select({ presentCharacters: gameStateSnapshots.presentCharacters })
        .from(gameStateSnapshots)
        .where(
          and(
            eq(gameStateSnapshots.chatId, chatId),
            eq(gameStateSnapshots.messageId, messageId),
            eq(gameStateSnapshots.swipeIndex, swipeIndex),
          ),
        )
        .limit(1);
      return rows[0] ? parseTrackedCharacters(rows[0].presentCharacters) : [];
    },
    async appendRoleplayEvent(input: CapabilityRoleplayEventInput): Promise<CapabilityRoleplayEventRecord | null> {
''', f"{rel}: tracker read implementation")
changes[rel] = text

rel = "packages/server/src/services/capability-packages/capability-resources.service.ts"
text = read(rel)
text = replace_once(text, '''  CapabilityLorebookEntryInput,
''', '''  CapabilityLorebookEntryInput,
  CapabilityLorebookEntryUpdateInput,
''', f"{rel}: update type import")
text = replace_once(text, '''    async removeLorebookEntry(entryId: string): Promise<void> {
      await lorebooks.removeEntry(entryId);
    },
''', '''    async updateLorebookEntry(entryId: string, updates: CapabilityLorebookEntryUpdateInput): Promise<void> {
      await lorebooks.updateEntry(entryId, updates);
    },

    async removeLorebookEntry(entryId: string): Promise<void> {
      await lorebooks.removeEntry(entryId);
    },
''', f"{rel}: update implementation")
changes[rel] = text

rel = "packages/server/src/services/capability-packages/capability-module-runtime.service.ts"
text = read(rel)
text = replace_once(text, '''  type CapabilityRuntimeHost,
''', '''  type CapabilityAgentPipelineSettledHandler,
  type CapabilityRuntimeHost,
''', f"{rel}: handler type import")
text = replace_once(text, '''import { registerCapabilityService } from "./capability-service-registry.service.js";
''', '''import { registerCapabilityService } from "./capability-service-registry.service.js";
import { registerCapabilityAgentPipelineSettledHandler } from "./capability-agent-lifecycle.service.js";
''', f"{rel}: lifecycle service import")
text = replace_once(text, '''    registerService<T>(key: string, service: T): Cleanup;
    /** Contribute text to each turn's system prompt. Requires the `prompt-context` permission. */
''', '''    registerService<T>(key: string, service: T): Cleanup;
    registerAgentPipelineSettledHandler(handler: CapabilityAgentPipelineSettledHandler): Cleanup;
    /** Contribute text to each turn's system prompt. Requires the `prompt-context` permission. */
''', f"{rel}: activation API type")
text = replace_once(text, '''          registerService: (key, service) => trackCleanup(registerCapabilityService(key, service)),
          // Gated on the permission the manifest already declares, so a package can't reach the prompt
''', '''          registerService: (key, service) => trackCleanup(registerCapabilityService(key, service)),
          registerAgentPipelineSettledHandler: (handler) => {
            if (!installed.manifest.permissions?.includes("agent-runtime")) {
              throw new Error(
                `Capability package ${installed.id} must declare the "agent-runtime" permission to observe agent lifecycle`,
              );
            }
            return trackCleanup(registerCapabilityAgentPipelineSettledHandler(handler));
          },
          // Gated on the permission the manifest already declares, so a package can't reach the prompt
''', f"{rel}: activation API implementation")
changes[rel] = text

rel = "packages/server/src/routes/generate.routes.ts"
text = read(rel)
text = replace_once(text, '''import { getCapabilityService } from "../services/capability-packages/capability-service-registry.service.js";
''', '''import { getCapabilityService } from "../services/capability-packages/capability-service-registry.service.js";
import { dispatchCapabilityAgentPipelineSettled } from "../services/capability-packages/capability-agent-lifecycle.service.js";
''', f"{rel}: lifecycle import")

text = insert_before_once(text, '''            for (const textRewriteAgent of activatedTextRewriteRunAgents) {
''', '''            if (messageId) {
              await dispatchCapabilityAgentPipelineSettled({
                chatId: input.chatId,
                generationId,
                messageId,
                swipeIndex,
              });
            }

''', f"{rel}: pipeline-settled dispatch")
changes[rel] = text

rel = "scripts/regressions/capability-package-lifecycle.regression.ts"
text = read(rel)
text = replace_once(text, '''  assert.deepEqual(supportedCapabilityApi, { major: 1, minor: 13 });
''', '''  assert.deepEqual(supportedCapabilityApi, { major: 1, minor: 14 });
''', f"{rel}: supported API assertion")
text = replace_once(text, '''    /requires capability API 2\\.0; this Engine supports 1\\.13/,
''', '''    /requires capability API 2\\.0; this Engine supports 1\\.14/,
''', f"{rel}: major error assertion")
text = replace_once(text, '''    capabilityApi: { major: 1, minor: 13 },
''', '''    capabilityApi: { major: 1, minor: 14 },
''', f"{rel}: current minor fixture")
text = replace_once(text, '''    capabilityApi: { major: 1, minor: 14 },
''', '''    capabilityApi: { major: 1, minor: 15 },
''', f"{rel}: unsupported minor fixture")
text = replace_once(text, '''    /requires capability API 1\\.14; this Engine supports 1\\.13/,
''', '''    /requires capability API 1\\.15; this Engine supports 1\\.14/,
''', f"{rel}: minor error assertion")

text = insert_before_once(text, '''  const forwardCompatibleCatalog = capabilityCatalogSchema.parse({
''', '''  const {
    dispatchCapabilityAgentPipelineSettled,
    registerCapabilityAgentPipelineSettledHandler,
    resetCapabilityAgentPipelineSettledHandlers,
  } = await import(
    "../../packages/server/src/services/capability-packages/capability-agent-lifecycle.service.js"
  );
  resetCapabilityAgentPipelineSettledHandlers();
  const lifecycleCalls: string[] = [];
  const cleanupFirst = registerCapabilityAgentPipelineSettledHandler(async (event) => {
    lifecycleCalls.push(`first:${event.messageId}:${event.swipeIndex}`);
  });
  const cleanupBroken = registerCapabilityAgentPipelineSettledHandler(async () => {
    throw new Error("expected lifecycle regression failure");
  });
  const cleanupSecond = registerCapabilityAgentPipelineSettledHandler(async (event) => {
    lifecycleCalls.push(`second:${event.generationId}`);
  });
  await dispatchCapabilityAgentPipelineSettled({
    chatId: "chat-1",
    generationId: "generation-1",
    messageId: "message-1",
    swipeIndex: 2,
  });
  assert.deepEqual(
    lifecycleCalls,
    ["first:message-1:2", "second:generation-1"],
    "all lifecycle subscribers run and one failure does not suppress the others",
  );
  cleanupFirst();
  cleanupBroken();
  cleanupSecond();
  resetCapabilityAgentPipelineSettledHandlers();

''', f"{rel}: lifecycle regression")
changes[rel] = text

for rel, content in changes.items():
    write(rel, content)

print("[OK] Capability API 1.14 source changes applied.")
print("[NEXT]")
print("  git diff --check")
print("  git diff --stat")
print("  pnpm check")
