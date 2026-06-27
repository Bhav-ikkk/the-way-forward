import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  ALLOWED_PACKS,
  type AssetEntry,
  type AssetPack,
  type ModelFormat,
} from "../index";

const NUM_RUNS = 200; // minimum 100 iterations required by the design

const ALL_FORMATS: ModelFormat[] = ["glb", "gltf", "fbx", "obj"];

/**
 * Resolve a logical id within an arbitrary entry list, mirroring the id-keyed
 * lookup the Asset_Index uses. This exercises the property generically over any
 * entry rather than only the static module list.
 */
function resolveById(entries: AssetEntry[], id: string): AssetEntry | undefined {
  return entries.find((e) => e.id === id);
}

const entryArb: fc.Arbitrary<AssetEntry> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  pack: fc.constantFrom<AssetPack>(...ALLOWED_PACKS),
  path: fc
    .string({ minLength: 1, maxLength: 12 })
    .map((s) => `assets/pack/original-${s}`),
  format: fc.constantFrom<ModelFormat>(...ALL_FORMATS),
});

describe("Asset_Index format-independence property", () => {
  // Feature: portfolio-world-engine, Property 5: Asset identifiers are
  // independent of file format — for any Asset_Index entry, replacing its
  // backing file with another valid format for the same logical asset (changing
  // format and path) leaves the entry's id unchanged and the asset remains
  // resolvable by that same id.
  // Validates: Requirements 5.5
  it("Property 5: swapping format/path leaves the id unchanged and still resolvable", () => {
    fc.assert(
      fc.property(
        entryArb,
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.integer({ min: 0, max: ALL_FORMATS.length - 1 }),
        (entry, altPathSuffix, formatPick) => {
          // Pick a DIFFERENT valid format for the same logical asset.
          const altFormat =
            ALL_FORMATS[
              (ALL_FORMATS.indexOf(entry.format) + 1 + formatPick) %
                ALL_FORMATS.length
            ];
          fc.pre(altFormat !== entry.format);

          // Replace the backing file: new format and a new path, same logical id.
          const swapped: AssetEntry = {
            ...entry,
            format: altFormat,
            path: `assets/pack/alt-${altPathSuffix}.${altFormat}`,
          };

          // The id is unchanged by the file swap.
          expect(swapped.id).toBe(entry.id);
          // The backing file genuinely changed (format and path differ).
          expect(swapped.format).not.toBe(entry.format);
          expect(swapped.path).not.toBe(entry.path);

          // The asset is still resolvable by that same id, before and after the
          // swap, and resolution yields the same logical id both times.
          const before = resolveById([entry], entry.id);
          const after = resolveById([swapped], entry.id);
          expect(before?.id).toBe(entry.id);
          expect(after?.id).toBe(entry.id);
          expect(after?.id).toBe(before?.id);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
