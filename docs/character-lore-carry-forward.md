# Character Lore carry-forward restoration

This branch restores request-scoped canonical Character Card carry-forward without requiring Character Cards to be permanently attached to the chat roster.

The current invariant is:

- a canonical Character Tracker `presentCharacters[].characterId` that resolves to a real Character Card remains request-scoped active on the next turn;
- the Engine loads that Character Card through the normal prompt loader;
- Marinara's existing referenced-character context builder attaches Character-linked Lore without mutating `chat.characterIds`;
- Character Tracker receives the same canonical card/lore baseline when Tracker lore attachment is enabled;
- Illustrator remains after Character Tracker and receives the fresh same-turn Tracker result through `current_turn_character_tracker_update`;
- Character Card tags may act as deterministic identity aliases for abbreviated narrative names such as `Eva`, `Anya`, or `Milla`; duplicate aliases are rejected as ambiguous.

This mechanism is not a Character Tracker persistence replacement. Tracker state itself is already persisted by Marinara in `game_state_snapshots`.

The former Pentad Bureau `character-lore-sync` capability package is no longer part of the design. It projected Tracker state back into LoreBook Current Outfit / Current State entries and duplicated Marinara's existing Tracker persistence. The running server intentionally has that package uninstalled.

For the current tested Pentad Bureau setup and prompt templates, see [`docs/pentad-bureau/README.md`](pentad-bureau/README.md).

This file remains as a regression/design note so request-scoped Character Card/Lore activation is not confused with the removed LoreBook state-projection layer.