# World Maps — Alderwick

This directory contains the maintained hierarchical map for the **The Pentad Bureau** campaign.

## Map file

- `Alderwick.world-map.json` — an importable World Maps definition in the stock Marinara World Maps format (format version 4).

The map contains 35 active locations: the two banks of the River Veyne, their districts, key public places, and the full three-level Pentad Bureau headquarters. Location names, public descriptions, awareness summaries, and AI-only notes are in English.

The starting location is `Pentad Bureau Headquarters`.

## Lorebook relationship

This is a **map-only** export. It intentionally does not contain a duplicate portable lorebook. Its location links point to the exact entry IDs in `../World-Lorebook/Alderwick.marinara.json`.

Import the current Alderwick Lorebook into Marinara first, keep it enabled for the chat, and then import the map. If World Maps shows missing linked-lore warnings after import, do not save the map over a live world: the destination Lorebook uses different entry IDs and must be restored or relinked first.

## Recommended use

Create or import this file as a new shared world in the World Maps library, review it, and save it. Link new Roleplay or Game chats to that shared world when they should share one maintained Alderwick hierarchy.

Do not wholesale replace a map already referenced by an ongoing chat's history: historical location IDs must stay present. Create a new linked chat, or prepare a separate migration map that preserves the existing IDs.

## Status

The file passed local JSON, hierarchy, link-target, and Lorebook-ID checks. It is ready for in-app import; its live shared-world import and visual review are still to be tested.
