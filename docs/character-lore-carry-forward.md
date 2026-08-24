# Character Lore carry-forward restoration

This branch restores the request-scoped canonical Character Card carry-forward that was previously prototyped in `Marinara-extensions/patches/character-activation-runtime`.

The intended invariant is:

- a canonical Character Tracker `presentCharacters[].characterId` that resolves to a real Character Card remains request-scoped active on the next turn;
- the Engine loads that Character Card through the normal prompt loader;
- Marinara's existing referenced-character context builder attaches Character-linked Lore without mutating `chat.characterIds`;
- Character Tracker receives the same canonical card/lore baseline;
- Illustrator remains last and continues to use the fresh current-turn Tracker result.

This file exists as a regression/design note so this integration is not lost again.