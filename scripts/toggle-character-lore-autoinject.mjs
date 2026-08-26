import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const target = resolve(root, "packages/server/src/routes/generate.routes.ts");
const mode = process.argv[2] ?? "status";

const marker = "PENTAD_CHARACTER_LORE_AUTOINJECT_TEST_OFF";
const injectedBlock = [
  `        // ${marker}`,
  "        // A/B test: keep Character Tracker state intact, but prevent the fork's",
  "        // request-scoped carry-forward/registry IDs from pre-activating Character",
  "        // Cards and their linked Lorebooks. Normal Marinara lore matching and",
  "        // downstream Tracker/Illustrator state handling remain unchanged.",
  "        trackerCarryForwardCharacterIds.length = 0;",
  "        registryCharacterIds.length = 0;",
  "",
].join("\n");

const anchor = "        const effectiveLorebookCharacterIds = Array.from(\n";
let source = readFileSync(target, "utf8");
const isOff = source.includes(marker);

function fail(message) {
  console.error(`[character-lore-autoinject] ${message}`);
  process.exit(1);
}

if (!source.includes("CHARACTER_LORE_EFFECTIVE_IDS_V1")) {
  fail("expected CHARACTER_LORE_EFFECTIVE_IDS_V1 marker was not found; refusing to edit");
}
if (!source.includes("CHARACTER_LORE_REGISTRY_IDS_V1")) {
  fail("expected CHARACTER_LORE_REGISTRY_IDS_V1 marker was not found; refusing to edit");
}

if (mode === "status") {
  console.log(`[character-lore-autoinject] ${isOff ? "OFF (clean search_lorebook test mode)" : "ON (fork carry-forward/registry active)"}`);
  process.exit(0);
}

if (mode === "off") {
  if (isOff) {
    console.log("[character-lore-autoinject] already OFF");
    process.exit(0);
  }
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) fail("effectiveLorebookCharacterIds anchor was not found; refusing to edit");
  source = source.slice(0, anchorIndex) + injectedBlock + source.slice(anchorIndex);
  writeFileSync(target, source, "utf8");
  console.log("[character-lore-autoinject] OFF: carry-forward and registry pre-activation disabled");
  console.log("[character-lore-autoinject] normal keyword/semantic/recursive Lore matching remains active");
  process.exit(0);
}

if (mode === "on") {
  if (!isOff) {
    console.log("[character-lore-autoinject] already ON");
    process.exit(0);
  }
  if (!source.includes(injectedBlock)) {
    fail("test marker exists but the expected injected block differs; refusing unsafe removal");
  }
  source = source.replace(injectedBlock, "");
  writeFileSync(target, source, "utf8");
  console.log("[character-lore-autoinject] ON: original fork carry-forward/registry behavior restored");
  process.exit(0);
}

fail(`unknown mode '${mode}'. Use: status | off | on`);
