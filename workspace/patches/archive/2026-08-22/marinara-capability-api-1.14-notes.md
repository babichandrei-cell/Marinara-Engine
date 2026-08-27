# Capability API 1.14 draft patch notes

Purpose: enable a downloadable server-runtime package to deterministically project persisted Character Tracker state into Lorebook entries without any LLM call.

The patch adds three generic host primitives:

1. A multi-subscriber `agent pipeline settled` lifecycle seam dispatched after post-processing results have been retried/finalized and durably applied to their `(messageId, swipeIndex)` anchor.
2. `getCharacterTrackerState(chatId, messageId, swipeIndex)` on the capability persistence host.
3. `updateLorebookEntry(entryId, updates)` on the capability resource host.

Important implementation check before applying:
- The hunk in `generate.routes.ts` is intentionally anchored conceptually around the end of the existing `for (const result of sortedResults)` persistence loop. Because this file is very large and rapidly changing, verify the insertion is after *all* normal tracker/result persistence but before later rewrite/follow-up cleanup.
- Run the full TypeScript check. `CapabilityLorebookEntryUpdateInput` is intentionally narrower than the engine's internal `UpdateLorebookEntryInput`; all fields are optional and structurally compatible with the `updateEntry` call observed on current main.
- Add an integration regression for anchored tracker reads once using a real `gameStateSnapshots` fixture. The included lifecycle regression covers multi-subscriber dispatch and error isolation but does not yet exercise DB anchoring.
- Consider whether lifecycle callbacks should be awaited serially or via `Promise.allSettled`. This draft uses parallel best-effort delivery; it does not fail the generation.
- The `agent-runtime` permission gates lifecycle observation.

Expected Character Lore Sync package contract after this patch:

```ts
export async function activate(context) {
  const { persistence, resources } = context.api.runtime;

  if (!persistence.getCharacterTrackerState || !resources.updateLorebookEntry) {
    throw new Error("Character Lore Sync requires Capability API 1.14");
  }

  return context.api.registerAgentPipelineSettledHandler(
    async ({ chatId, messageId, swipeIndex }) => {
      const tracker = await persistence.getCharacterTrackerState(
        chatId,
        messageId,
        swipeIndex,
      );
      // deterministic outfit upsert; no LLM
    },
  );
}
```
