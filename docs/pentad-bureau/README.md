# Pentad Bureau Marinara fork state

This directory records the tested operational state of the Pentad Bureau Marinara installation so the fork can be resumed without reconstructing prior work from chat history.

## Current server baseline

- Runtime: Docker Compose deployment of this fork.
- Working branch on the server: `staging`.
- Character Tracker, Illustrator, and World State are active downloadable Agent packages.
- Character Lore Sync has been uninstalled and is intentionally obsolete for this setup. Character Tracker snapshots are the canonical persistent scene-state mechanism; duplicating Tracker state into LoreBook entries is no longer required.
- Character Tracker snapshots persist in Marinara's `game_state_snapshots` storage and are carried forward as scene state between turns.
- Character Card identities can be resolved from unique Character Card tags, so abbreviated scene names such as `Eva`, `Anya`, and `Milla` can resolve to canonical card IDs even when the cards are not attached to the chat roster.
- Request-scoped Character Card/Lore carry-forward remains active: canonical tracked Character Card IDs can activate their card-linked lore on following turns without mutating the chat roster.
- Illustrator receives the successful Character Tracker result from the same turn through `current_turn_character_tracker_update` and runs after Character Tracker.
- Illustrator is configured to illustrate the final visual state of the latest assistant response, not an earlier phase of a multi-phase response. Its visible cast must be compatible with final `Character Tracker.presentCharacters`.

## Why Character Lore Sync was removed

Earlier builds projected Character Tracker state into the chat-pinned LoreBook as Current Outfit / Current State entries. Testing showed that this duplicated state Marinara already persists in `game_state_snapshots` and created an unnecessary second source of truth. The capability package `character-lore-sync` was therefore uninstalled from the running server and should not be restored unless a future feature explicitly requires a LoreBook projection.

The intended state pipeline is now:

```text
Main model response
        |
        v
Character Tracker
  - final presentCharacters
  - persistent appearance/state
  - structured wardrobe
        |
        v
current_turn_character_tracker_update
        |
        v
Illustrator
  - final visual moment only
  - final Tracker cast/state is authoritative
        |
        v
Image generation
```

## Character identity resolution

Character cards do not need to be attached to a chat for Tracker identity matching. The Engine builds a Character Library identity catalog and resolves Tracker characters using stable ID, canonical name, and unique Character Card tags/aliases. Duplicate aliases are deliberately rejected as ambiguous.

For the Pentad cards, tags are maintained manually and must remain unique. This allows narrative forms such as `Eva`, `Anya`, `Milla`, etc. to map back to their canonical Character Card IDs and avatars.

## Structured wardrobe

The Character Tracker prompt used by this installation keeps Marinara's normal persistent-character semantics but adds a structured `wardrobe` object. `outfit` remains a readable summary; `wardrobe` is the visual source of truth for individual slots, garment state, accessories, carried items, and exposed areas.

See [character-tracker-structured-wardrobe.md](character-tracker-structured-wardrobe.md) for the exact working prompt template.

## Illustrator final-state rule

A single assistant response can contain several chronological phases. Character Tracker represents the final scene snapshot after the response. Illustrator therefore must not choose an earlier visually attractive phase whose cast/state conflicts with the final Tracker snapshot.

See [illustrator-final-state.md](illustrator-final-state.md) for the exact working prompt template and rationale.

## Server/package verification

At the end of the August 25, 2026 session, `character-lore-sync` was removed through the privileged capability-package API and the Marinara container was restarted. Verification showed:

```text
installed.json: character-lore-sync absent
versions/character-lore-sync: removed
runtime log: Deactivated capability package character-lore-sync
```

The active package set relevant to this integration is therefore Character Tracker, Illustrator, and World State; Character Lore Sync is not part of the desired final server state.

## Resume checklist

When continuing work, verify these invariants before changing architecture:

1. Character Tracker still receives active lore when the chat's Attach Lorebooks to Trackers option is enabled.
2. Character Tracker output still carries canonical Character Card IDs for tagged Pentad characters.
3. `game_state_snapshots` still contains the structured `wardrobe` object and preserves it between turns.
4. Illustrator still receives `current_turn_character_tracker_update` before generating its prompt.
5. Illustrator still uses the final-response/final-Tracker visual phase rule.
6. Character Lore Sync remains uninstalled unless intentionally reintroduced for a new purpose.

This documentation describes the tested Pentad Bureau fork behavior, not upstream Marinara defaults.