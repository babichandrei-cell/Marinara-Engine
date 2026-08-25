# Character Tracker — Structured Wardrobe prompt

This is the tested Prompt Option used for the Pentad Bureau Character Tracker. It intentionally keeps the native Character Tracker persistence model while making clothing state deterministic enough for downstream image generation.

```text
Track NPCs and party members currently present in the scene after the latest assistant message. Do NOT include the player's {{user}}; Persona Stats and World State handle the player.

Respond ONLY with valid JSON.

Schema:
{
  "presentCharacters": [
    {
      "characterId": "string — ID or name",
      "name": "string — display name",
      "emoji": "string — 1 emoji",
      "mood": "string — one word",
      "appearance": "string|null — persistent physical traits",
      "outfit": "string|null — concise complete description of the character's current visible clothing state",
      "wardrobe": {
        "upperBody": {
          "item": "string|null",
          "description": "string|null",
          "state": "worn|open|unfastened|removed|damaged|none"
        },
        "lowerBody": {
          "item": "string|null",
          "description": "string|null",
          "state": "worn|open|unfastened|removed|damaged|none"
        },
        "outerwear": {
          "item": "string|null",
          "description": "string|null",
          "state": "worn|open|unfastened|removed|damaged|none"
        },
        "legwear": {
          "item": "string|null",
          "description": "string|null",
          "state": "worn|removed|damaged|none"
        },
        "footwear": {
          "item": "string|null",
          "description": "string|null",
          "state": "worn|removed|damaged|none"
        },
        "underwearUpper": {
          "item": "string|null",
          "description": "string|null",
          "state": "worn|removed|none"
        },
        "underwearLower": {
          "item": "string|null",
          "description": "string|null",
          "state": "worn|removed|none"
        },
        "accessories": [
          {
            "item": "string",
            "description": "string|null",
            "state": "worn|held|removed|damaged"
          }
        ],
        "carriedItems": [
          {
            "item": "string",
            "description": "string|null",
            "state": "held|carried|set_down"
          }
        ],
        "exposedAreas": ["string"]
      },
      "thoughts": "string|null — one sentence of unspoken current thoughts",
      "customFields": { "exact existing field name": "string value" },
      "stats": [
        {
          "name": "string",
          "value": number,
          "max": number,
          "color": "string (hex)"
        }
      ]
    }
  ]
}

Instructions:
1. presentCharacters is the current scene snapshot. Characters persist from the prior presentCharacters state until they clearly leave, are dismissed, or the scene moves away from them. Add a character only when the current narrative establishes their arrival or presence.
2. Character cards and active lore provide character details, not evidence of current presence. Never add or restore a character merely because they appear in lore, character data, or older context.
3. For characters determined to be present, preserve mood, appearance, outfit, wardrobe, thoughts, customFields, and stats unless the narrative changes them. Fill missing appearance and clothing details from character cards, active lore, or prior tracker state.
4. "outfit" is a readable summary of the complete current clothing state. "wardrobe" is the structured source of truth for individual garments and accessories.
5. Keep outfit and wardrobe consistent with each other.
6. Clothing persists between turns. Change only garments or states explicitly changed by the narrative or required by authoritative lore.
7. When state is "none", item and description MUST be null. Never use the string "none" as an item or description.
8. For one-piece garments such as dresses, place the garment in upperBody and leave lowerBody as state "none". The garment description must include its full length/cut.
9. A removed garment remains represented in its slot with state "removed". If its location is established, mention it in description or carriedItems.
10. Record visible partial states such as open or unfastened when established. Do not silently convert them back to fully worn.
11. accessories contains personal accessories not represented by the fixed clothing slots. carriedItems contains relevant objects associated with the character that are held, carried, or explicitly set down.
12. exposedAreas contains currently visible bare body areas relevant to visual continuity. Do not infer exposure that is not supported by clothing state, narrative, character data, or active lore.
13. Make garment descriptions visually useful: include garment type, important color/material, cut or length, and distinguishing details when established. Avoid vague alternatives such as "boots or heels".
14. Do not invent unnecessary fashion details. Prefer established character/lore details and prior wardrobe state.
15. For existing customFields, preserve every exact field name and update only changed values.
16. Track HP, MP, and other card pools/stats realistically; use card initial values as maximums where applicable.
17. Reuse known characterId values. Do not create duplicate characters because a name is written differently.
18. Return the complete presentCharacters snapshot every time.
```

## Tested behavior

The structured state persists through `game_state_snapshots`, including changed garment/accessory states and newly introduced visual items. For example, removing gloves persists as a removed accessory and putting on goggles persists on subsequent turns.

A Character Card or lore entry is never evidence of current presence by itself. This restriction is important because broad active LoreBook context can contain off-scene Pentad characters.