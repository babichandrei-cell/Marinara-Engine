# Illustrator — Final scene state prompt

The Pentad Bureau Illustrator must illustrate the final visual phase of the latest assistant response. Character Tracker is the authoritative final scene snapshot for cast and current visual state.

This rule exists because one assistant response can contain multiple chronological phases. If Illustrator selects an earlier phase after Character Tracker has already reduced the turn to its final state, characters from that earlier phase may no longer exist in `current_turn_character_tracker_update`, forcing Illustrator to invent appearance or clothing. The final-state rule removes that temporal mismatch.

## Working prompt template

```text
Create an image-generation prompt for the current roleplay scene.

Illustrate the final visual state of the latest assistant response.
Use the latest chronologically depicted scene or moment that is visually coherent with the final Character Tracker state.
Do not illustrate an earlier phase of the response when the scene, character presence, or visual state has changed afterward.

Use {{agent::character-tracker}} as the authoritative final scene snapshot.
Only include characters present in its presentCharacters array.

Return valid JSON only:

{
  "shouldGenerate": boolean,
  "reason": "brief explanation",
  "prompt": "image generation prompt",
  "characters": ["visible character names"]
}

Prompt rules:

Cinematic style, volumetric light, moody atmosphere.

Describe only the final current visible scene.

Include:
- composition;
- environment;
- lighting;
- visible objects;
- every visible character.

For each visible character and NPC include:
- full name;
- appearance;
- current outfit;
- visible accessories;
- pose;
- action.

For each visible character and NPC, use their current Character Tracker appearance, outfit, wardrobe, accessories, and carried items when available.
Do not reconstruct an earlier clothing or character state from narrative context.
If an earlier part of the assistant response contains characters who are absent from the final Character Tracker state, do not include them.

Do not invent missing physical details.
Do not replace established clothing with alternatives.
Do not describe thoughts, dialogue, or invisible emotions.
Do not add characters not present in the final scene.
```

## Runtime integration

The Engine passes the successful same-turn Character Tracker output to Illustrator in:

```xml
<current_turn_character_tracker_update>
...
</current_turn_character_tracker_update>
```

That block is newer than the committed `current_game_state` and is authoritative for the image being produced. Illustrator is sequenced after Character Tracker in the post-processing pipeline.

The resulting temporal contract is:

```text
assistant response may contain A -> B -> C
Character Tracker = final state C
Illustrator = latest visually coherent moment in C
```

This is intentionally different from storyboard/comic behavior. A future multi-panel renderer may deliberately use several chronological phases, but a normal single automatic illustration uses one final-state frame.