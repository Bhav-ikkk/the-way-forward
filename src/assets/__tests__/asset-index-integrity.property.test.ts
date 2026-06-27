import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  findBrokenEntries,
  ALLOWED_PACKS,
  ASSET_PLACEHOLDERS,
  type AssetEntry,
  type AssetPack,
  type ModelFormat,
} from "../index";

const NUM_RUNS = 200; // minimum 100 iterations required by the design

const ALLOWED_PACKS_SET: ReadonlySet<string> = new Set(ALLOWED_PACKS);

const formatArb = fc.constantFrom<ModelFormat>("glb", "gltf", "fbx", "obj");

// A pool of paths the "library" may or may not contain.
const pathPoolArb = fc.string({ minLength: 1, maxLength: 12 }).map(
  (s) => `assets/pack/${s}.glb`,
);

// Packs are a mix of the six allowed packs and clearly-invalid pack names so
// that the iff condition is exercised on both sides. Invalid packs are cast to
// AssetPack to model malformed/hand-edited data reaching the integrity check.
const packArb = fc.oneof(
  fc.constantFrom<AssetPack>(...ALLOWED_PACKS),
  fc.constantFrom(
    "bogus_pack",
    "Weapons",
    "",
    "character ", // trailing space — not an exact match
  ) as unknown as fc.Arbitrary<AssetPack>,
);

const entryArb: fc.Arbitrary<AssetEntry> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  pack: packArb,
  path: pathPoolArb,
  format: formatArb,
});

describe("Asset_Index integrity properties", () => {
  // Feature: portfolio-world-engine, Property 4: Asset index integrity — for
  // any set of Asset_Index entries and any set of known Asset_Library files,
  // findBrokenEntries reports a non-placeholder entry as broken if and only if
  // its mapped file is absent from the known files OR its pack is not one of
  // the six allowed packs; needed-but-missing assets appear only as
  // Placeholder_Entry records and never as path-bearing entries.
  // Validates: Requirements 5.1, 5.2, 5.3
  it("Property 4: findBrokenEntries reports broken iff file missing or pack invalid", () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { maxLength: 8 }),
        fc.array(pathPoolArb, { maxLength: 8 }),
        (entries, knownFileList) => {
          const knownFiles = new Set(knownFileList);
          const broken = new Set(findBrokenEntries(entries, knownFiles));

          for (const entry of entries) {
            const packAllowed = ALLOWED_PACKS_SET.has(entry.pack);
            const fileExists = knownFiles.has(entry.path);
            const expectedBroken = !packAllowed || !fileExists;
            // Precise iff: reported broken exactly when its file is missing or
            // its pack is not one of the six allowed packs.
            expect(broken.has(entry.id)).toBe(expectedBroken);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // The declared Placeholder_Entry records carry no path and so are structurally
  // incapable of being reported by the path-based integrity check. (Same
  // property, structural half: placeholders never carry paths.)
  // Validates: Requirements 5.3
  it("Property 4 (structural): known placeholders carry no path", () => {
    for (const placeholder of ASSET_PLACEHOLDERS) {
      expect("path" in placeholder).toBe(false);
      expect(placeholder.placeholder).toBe(true);
    }
  });
});
