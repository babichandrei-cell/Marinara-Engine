# Pentad Bureau fork changelog

This changelog records fork-specific integration work that may not belong in upstream Marinara release notes.

## 2026-08-25 — Character Tracker / Illustrator state integration

### Finalized

- Confirmed that Character Tracker state is persisted by Marinara in `game_state_snapshots` and survives between turns.
- Reworked the Character Tracker Prompt Option to add a structured `wardrobe` object while retaining a readable `outfit` summary.
- Added garment slot states including `worn`, `open`, `unfastened`, `removed`, `damaged`, and `none`, plus structured accessories, carried items, and exposed areas.
- Confirmed persistence of clothing changes and accessories across turns, including removed garments/accessories and newly worn visual items.
- Tightened presence semantics so Character Cards and LoreBook context provide details only and are not evidence that a character is physically present.
- Confirmed same-turn Character Tracker output is injected into Illustrator through `current_turn_character_tracker_update`.
- Changed Illustrator prompt semantics to render the final visual phase of the latest assistant response and to use final `presentCharacters` as the authoritative visible cast.
- Added Character Card tag aliases to Tracker identity resolution. Unique tags allow abbreviated names such as `Eva`, `Anya`, and `Milla` to resolve to canonical card IDs even for off-roster cards; ambiguous duplicate aliases are ignored.
- Preserved request-scoped Character Card/Lore carry-forward without attaching Character Cards permanently to the chat roster.

### Removed from the active server design

- Uninstalled the custom `character-lore-sync` capability package (`0.2.4`). It duplicated Tracker persistence by projecting Current Outfit / Current State records into the chat-pinned LoreBook.
- The desired architecture now uses native Character Tracker persistence as the single persistent scene-state source. LoreBook projection is not required for Character Tracker -> Illustrator continuity.

### Verified

- The alias patch passed the server lint/typecheck workflow on `staging`.
- The temporary one-shot staging patch workflow removed itself after applying the patch.
- `character-lore-sync` is absent from the running server's installed capability registry and package-version directory after restart.

See [`README.md`](README.md), [`character-tracker-structured-wardrobe.md`](character-tracker-structured-wardrobe.md), and [`illustrator-final-state.md`](illustrator-final-state.md) for the current operational contract.