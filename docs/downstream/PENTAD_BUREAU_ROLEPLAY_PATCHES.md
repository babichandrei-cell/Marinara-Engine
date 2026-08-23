# Pentad Bureau — Marinara Engine downstream Roleplay patches

This document is the recovery checkpoint for the downstream Marinara Engine changes developed for The Pentad Bureau Roleplay setup. Its purpose is to make the intent, architecture, history, tests, companion patch lineage, and remaining work recoverable without relying on a previous chat session.

## Repository topology

Development fork: `babichandrei-cell/Marinara-Engine`.

- downstream remote: `origin`
- upstream repository: `Pasta-Devs/Marinara-Engine`
- upstream remote: `upstream`
- feature branch: `feature/global-tracker-character-identity`
- pre-experiment base: `24453ecf00cd02602ff1c593c440118dfe733b44` (`merge: integrate Character Lore Sync support`)
- last functional feature commit before documentation: `0ad4d21d72c6d9bf642fc6867a015a12af95397c`
- first recovery-documentation commit: `8a13593e6701d1351d2353dfc83403899e48aca3` (`docs: document downstream roleplay identity patches`)

## Why these patches exist

The Pentad Bureau Roleplay setup uses Character Tracker as the authoritative dynamic character-state source and Character Lore Sync as persistent Lore projection.

Several sets of characters must remain distinct:

1. Character Cards stored in the Character Library;
2. characters currently present in Character Tracker;
3. NPCs that exist only as Tracker state;
4. Characters attached to the chat roster;
5. Characters whose Lore entries should be eligible for the current prompt.

The original behavior was insufficient for off-roster Character Cards. Tracker output could refer to a known Character Card by name while failing to retain its stable Character Card id, producing a parallel identity such as `characterId: "Eva Green"` instead of the stable Character Library id.

After canonical Tracker identity was solved, Character-linked Lore had a second problem: LoreBook ownership filtering occurs before entry-level matching can use `gameState.presentCharacters`. An off-roster Character could therefore lose Character-linked Lore eligibility on a later turn when the user used only a pronoun and did not repeat the Character's name.

The downstream feature line solves these as related but separate identity and Lore-scope problems.

## Architectural invariants

### Character Tracker is scene-presence authority

Character Tracker determines which characters are actually present in the current scene. Lore eligibility must not be treated as scene presence. Making a Character Lore-eligible does not add that Character to Tracker state or to the chat roster.

### Character Library is canonical Character Card identity authority

When Tracker output corresponds to a real Character Card, the stable Character Library id is canonical. Character Library identity lookup is deliberately minimal: it exposes identity information required for matching without injecting Character Card prompt fields merely because a card exists in the library.

### NPC identities remain NPC identities

Unknown Tracker identities and NPC identities must not acquire Character-linked LoreBook ownership scope. Only ids that resolve to actual Character Library cards participate in the Tracker-to-Lore Character bridge.

### Character Card tags are identity aliases

Character Card tags may be used as user-maintained aliases for conservative current-turn identity recognition. Alias matching is deterministic, Unicode-aware, and ambiguity-safe. An alias shared by multiple Character Cards is not used for automatic identity resolution.

### Lore identity resolution is deterministic

This downstream Character/Lore identity feature performs no additional LLM request. Current Lore Character scope is derived from deterministic state:

`promptCharacterIds + trackerLoreCharacterIds + bootstrapLoreCharacterIds`

The existing upstream `selectSmartGroupResponders()` function is unrelated. It is Marinara's pre-existing smart group-response selector and may perform its own model request for responder selection. It was not introduced by this feature line.

## Companion downstream patch lineage

The Roleplay identity feature does not stand alone. A complete recovery of the tested Pentad Bureau Marinara environment must also account for the Engine support lineage that existed before `feature/global-tracker-character-identity`.

### `marinara-empty-send-continue-v8`

`marinara-empty-send-continue-v8` is the historical Roleplay prompt-only empty-send continuation patch from the same downstream lineage. It addresses the Roleplay continuation path where an empty send is intentionally used to continue generation rather than being treated as ordinary user text.

Treat this name as a recovery marker for the historical patch artifact. The current tested Capability API patch described below already includes the Roleplay prompt-only empty-send continuation change, so do not blindly stack the historical empty-send patch on top of `capability-api-1.14-current.patch`. If reconstructing from older standalone artifacts, compare/apply-check first and avoid duplicating the same hunks.

The exact standalone `marinara-empty-send-continue-v8` artifact location/hash is not currently recorded in this repository; preserve it separately when the original artifact is available.

### `capability-api-1.14-current.patch`

The current tested Capability API support patch is maintained in the companion repository:

`babichandrei-cell/Marinara-extensions`

at:

`patches/capability-api-1.14/capability-api-1.14-current.patch`

Its companion README records:

- Marinara Engine baseline: `v2.4.3`
- baseline commit: `34442e26d`
- tested integration branch head: `24453ecf0`
- SHA-256: `7e912ceb0aab3d0c3b1332840fc187956c07510c9b3e94968eda7990a2bd0639`

The patch provides the Capability API 1.14 support required by Character Lore Sync, including:

- agent-pipeline-settled lifecycle support;
- authoritative Character Tracker reads anchored to persisted message/swipe state;
- Character Tracker `customFields` passthrough;
- capability LoreBook entry create/update surfaces;
- Character LoreBook ownership links;
- trusted local Capability Package artifact installation support;
- embedded Character Book synchronization after capability Lore writes;
- post-generation Character/Lore client cache reconciliation;
- the related regression coverage committed with the Engine integration;
- the Roleplay prompt-only empty-send continuation behavior from the earlier patch lineage.

This patch was verified with `git apply --check` against clean Engine commit `34442e26d`. Do not assume it applies cleanly to later upstream Marinara versions without revalidation.

### Relationship to the current feature branch

`24453ecf00cd02602ff1c593c440118dfe733b44` is both the tested Capability API integration head and the pre-experiment base for the Character identity/Lore-scope feature documented here.

Therefore the intended lineage is conceptually:

`Marinara v2.4.3 / 34442e26d`
→ Roleplay empty-send continuation lineage (`marinara-empty-send-continue-v8`)
→ Capability API 1.14 / Character Lore Sync Engine support (`24453ecf0`)
→ global Tracker Character identity and Lore eligibility feature (`b286c760b` → `a7be63ea` → `b7b59b8f` → `0ad4d21d`)

When recovering or rebasing, preserve this ordering and re-test each responsibility independently.

## Feature history

### `b286c760b466d17a13077d500031a6e3715c6cd1`

`experiment: canonicalize tracker identities from character library`

Character Tracker canonicalization was expanded from the active roster to the wider Character Library.

Important behavior:

- Character Library is loaded as an identity catalog;
- built-in assistants are excluded;
- roster identities retain priority;
- duplicate normalized names remain ambiguous;
- known off-roster Character Cards can receive their stable Character Card id;
- the same canonicalization semantics are used by normal generation and Retry Agents;
- NPCs that do not resolve to Character Cards remain untouched.

Primary implementation areas:

- `packages/server/src/routes/generate.routes.ts`
- `packages/server/src/routes/generate/generate-route-utils.ts`
- `packages/server/src/routes/generate/retry-agents-route.ts`

### `a7be63ea29bb5c516e9fd1f2b09efe8be8d134a9`

`experiment: use tracker state for roleplay lore filtering`

Roleplay Lore processing was changed to receive the selected authoritative Game/Tracker state. This allows Lore matching context to see `presentCharacters` instead of processing Roleplay Lore with `gameState: null`.

This alone was not sufficient for Character-linked LoreBooks because LoreBook ownership filtering occurs before entry-level matching.

### `b7b59b8f741837f73d7455805d8a89b44109bd17`

`experiment: bootstrap roleplay lore from character library identities`

A distinct Lore Character scope was introduced. `resolveLoreCharacterIdsFromText()` conservatively resolves explicit Character Card names and Character Card tag aliases from current user input.

The resulting bootstrap ids are combined with prompt Character ids and passed through the Lore pipeline separately from ordinary prompt character selection. This distinction is propagated through `generate.routes.ts`, the prompt assembler, marker expander, and LoreBook processing.

This enables an off-roster Character Card explicitly named in the current user message to become Lore-eligible without adding it to the chat roster or Character Tracker.

### `0ad4d21d72c6d9bf642fc6867a015a12af95397c`

`feat: preserve tracker character lore eligibility`

The previous authoritative Tracker state is now another deterministic source of Character Lore identity. `resolveLoreCharacterIdsFromTrackerState()` accepts only Tracker character ids that correspond to actual Character Library identities.

Effective Roleplay Lore Character ids therefore become:

`promptCharacterIds + trackerLoreCharacterIds + bootstrapLoreCharacterIds`

This fixes the important second-turn case:

- Turn 1: the user explicitly names an off-roster Character Card; text bootstrap resolves the Character Library id; Character Tracker canonicalizes the Character to that stable id.
- Turn 2: the user refers to the Character only by a pronoun; text bootstrap no longer finds a name; previous authoritative Tracker state still contains the canonical Character Card id; Tracker-to-Lore bridging preserves Character-linked Lore eligibility.

NPC and unknown Tracker ids are explicitly filtered out.

## Current implementation locations

### `packages/server/src/routes/generate/generate-route-utils.ts`

Contains reusable identity primitives including:

- `CharacterIdentity`
- `loadCharacterIdentityCatalog`
- `loadTrackerCharacterIdentityCatalog`
- `mergeTrackerCharacterIdentityCatalog`
- `resolveLoreCharacterIdsFromText`
- `resolveLoreCharacterIdsFromTrackerState`
- `applyTrackerCharacterCardIdentity`

### `packages/server/src/routes/generate.routes.ts`

Builds the effective Roleplay Lore identity set and propagates it into the Lore pipeline.

Useful runtime debug line:

`[generate] Lore character ids: prompt=%j tracker=%j bootstrap=%j effective=%j`

### `packages/server/src/routes/generate/retry-agents-route.ts`

Keeps Character Tracker retry processing aligned with Character Library canonicalization semantics used by normal generation.

### `packages/server/src/services/prompt/assembler.ts`

Carries `loreCharacterIds` separately from prompt `characterIds`.

### `packages/server/src/services/prompt/marker-expander.ts`

Uses `loreCharacterIds` for LoreBook processing when provided while preserving normal prompt Character scope for other behavior.

### `scripts/regressions/roleplay-lore-character-identity.regression.ts`

Dedicated regression coverage for the downstream identity bridge.

## Verified runtime behavior

The feature was tested with an off-roster Character Card whose stable Character Library id was `hOOM5_L931hp6VwPgzmzS`.

On the first relevant turn the runtime log showed:

`prompt=[] tracker=[] bootstrap=["hOOM5_L931hp6VwPgzmzS"] effective=["hOOM5_L931hp6VwPgzmzS"]`

On the following turn, where the Character name was no longer repeated:

`prompt=[] tracker=["hOOM5_L931hp6VwPgzmzS"] bootstrap=[] effective=["hOOM5_L931hp6VwPgzmzS"]`

This confirms the intended handoff:

explicit-name bootstrap → canonical Tracker identity → persistent next-turn Lore eligibility.

## Regression and build verification

Dedicated regression:

`scripts/regressions/roleplay-lore-character-identity.regression.ts`

Verified result:

`Roleplay Lore Character identity regression passed.`

The modified Engine also successfully passed `pnpm build:shared` and `pnpm build:server` inside the Marinara builder Docker environment. `git diff --check` was clean before the feature commit.

The Capability API 1.14 integration line has its own regression set in the Engine/extension archive, including capability lifecycle, Character Tracker anchor, LoreBook write, Character Lore contract/behavior, embedded Character Book synchronization, post-generation resource refresh, and Character Lore Sync semantics coverage. Keep those regressions conceptually separate from the Roleplay identity regression even though the tested environment contains both lines.

## Additional LLM-call audit

The downstream commits between `24453ecf0` and feature head `0ad4d21d7` were audited for newly introduced model-call primitives such as `createLLMProvider`, `.generate(`, completion calls, selector prompts, and Character planning prompts.

No additional LLM/model call was introduced by this feature line.

A pre-existing upstream function named `selectSmartGroupResponders()` does make a hidden model request for smart group responder selection. Its relevant prompt predates these downstream changes and originates from upstream Marinara history. It is not part of the Tracker/Lore identity feature. Do not remove or modify it merely as cleanup for this downstream work.

## Relationship to Character Lore Sync

The Engine feature line works together with the separate Character Lore Sync capability package maintained for The Pentad Bureau.

Character Lore Sync projects authoritative Character Tracker state into persistent Lore. The Engine identity work documented here is important because Character-specific semantics can only be attached reliably when Tracker state contains the canonical Character Card id.

Keep the responsibilities separate: the Engine resolves identity and Lore eligibility; Character Lore Sync persists selected Tracker-derived state into Lore; Capability API 1.14 supplies the Engine surfaces/lifecycle needed by Character Lore Sync.

The Character Lore Sync release archive itself lives in `babichandrei-cell/Marinara-extensions` under `patches/character-lore-sync/`. Its release history and runtime-verification checkpoint should be treated as a companion source when reconstructing the complete tested environment.

## Important conceptual boundaries

Do not collapse these concepts into one variable:

- chat roster membership;
- physical scene presence;
- Character Library identity;
- prompt responder selection;
- LoreBook ownership eligibility;
- Lore entry activation;
- Character Lore Sync persistence;
- Capability API lifecycle/resource support;
- Roleplay empty-send continuation behavior.

In particular, a Character can be off-roster but present in Tracker; a Character can be Lore-eligible without being added to the roster; an NPC can exist in Tracker without acquiring Character Card semantics; smart responder selection is unrelated to Lore identity resolution; and the empty-send continuation patch is a prompt-flow behavior, not an identity mechanism.

## Safe resume procedure

When returning to this work in a new session:

1. Read this document first.
2. Confirm branch and remotes.
3. Confirm the Engine base/integration lineage: `34442e26d` → `24453ecf0` → current feature branch.
4. In `babichandrei-cell/Marinara-extensions`, inspect `patches/capability-api-1.14/README.md` and `capability-api-1.14-current.patch`.
5. Remember that the tested Capability API patch already contains the Roleplay prompt-only empty-send continuation change associated with `marinara-empty-send-continue-v8`; do not duplicate-apply it without checking.
6. Inspect the four functional identity/Lore commits after `24453ecf0`.
7. Run the dedicated Roleplay Lore Character identity regression.
8. Run/review the Capability API / Character Lore Sync regressions relevant to any Engine support changes.
9. Build shared + server in Docker.
10. Inspect the runtime Lore identity debug line during a real Roleplay turn.
11. Do not infer scene presence from Lore eligibility.
12. Do not introduce an additional LLM call for Character/Lore identity unless a new requirement cannot be satisfied from deterministic state.

Useful commands:

```bash
git status -sb
git remote -v
git log --reverse --oneline 24453ecf0..HEAD
git diff --check
```

Expected feature branch: `feature/global-tracker-character-identity`.

The last functional feature commit before the recovery documentation is `0ad4d21d72c6d9bf642fc6867a015a12af95397c`.

The initial recovery-documentation commit is `8a13593e6701d1351d2353dfc83403899e48aca3`; later documentation-only commits may follow it without changing the functional feature head.

## Known follow-up work

This checkpoint documents the currently verified feature rather than declaring the larger Roleplay architecture finished.

Future work should first determine whether a proposed change concerns identity canonicalization, Tracker scene presence, Lore scope, Lore activation, group responder selection, Character Lore Sync persistence, Capability API support, or empty-send continuation behavior. Changes should be made at the narrowest correct layer instead of merging these responsibilities.

Before changing identity semantics, extend `roleplay-lore-character-identity.regression.ts` with the failing case first.
