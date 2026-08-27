#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const TARGET = path.join(ROOT, "packages/server/src/routes/generate.routes.ts");

const ORIGINAL = `                const cardCharacterIds = applyTrackerCharacterCardIdentity(chars, trackerIdentityCatalog);`;

const DISABLED = `                // PENTAD_TRACKER_CHARACTER_ID_CANONICALIZATION_TEST_OFF
                // A/B test: preserve the Character Tracker model's raw characterId values.
                // Keep the canonical identity helper referenced for easy/reversible testing,
                // but do not execute it, because it mutates chars and replaces model IDs
                // with Character Card IDs.
                const cardCharacterIds = false
                  ? applyTrackerCharacterCardIdentity(chars, trackerIdentityCatalog)
                  : new Set<string>();`;

function fail(message) {
  console.error(`[tracker-character-id-canonicalization] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(TARGET)) {
  fail(`target not found: ${TARGET}`);
}

const command = process.argv[2] ?? "status";
let source = fs.readFileSync(TARGET, "utf8");
const isOff = source.includes("PENTAD_TRACKER_CHARACTER_ID_CANONICALIZATION_TEST_OFF");

if (command === "status") {
  console.log(
    isOff
      ? "[tracker-character-id-canonicalization] OFF (raw Tracker characterId values preserved)"
      : "[tracker-character-id-canonicalization] ON (Character Card identity canonicalization active)",
  );
  process.exit(0);
}

if (command === "off") {
  if (isOff) {
    console.log("[tracker-character-id-canonicalization] already OFF");
    process.exit(0);
  }
  if (!source.includes(ORIGINAL)) {
    fail("expected canonicalization call not found; refusing to patch an unknown source layout");
  }
  source = source.replace(ORIGINAL, DISABLED);
  fs.writeFileSync(TARGET, source);
  console.log("[tracker-character-id-canonicalization] OFF: raw model characterId values will be preserved");
  console.log("[tracker-character-id-canonicalization] Character Tracker execution and downstream pipeline remain enabled");
  process.exit(0);
}

if (command === "on") {
  if (!isOff) {
    console.log("[tracker-character-id-canonicalization] already ON");
    process.exit(0);
  }
  if (!source.includes(DISABLED)) {
    fail("test marker found but expected disabled block differs; refusing automatic restore");
  }
  source = source.replace(DISABLED, ORIGINAL);
  fs.writeFileSync(TARGET, source);
  console.log("[tracker-character-id-canonicalization] ON: Character Card identity canonicalization restored");
  process.exit(0);
}

fail(`unknown command '${command}'. Use: status | off | on`);
