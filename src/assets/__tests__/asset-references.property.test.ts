import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  getAsset,
  ASSET_INDEX,
  ASSET_PLACEHOLDERS,
  type AssetEntry,
  type AssetPlaceholder,
} from "../index";

const NUM_RUNS = 200; // minimum 100 iterations required by the design

// The logical ids an Adopter may legitimately place in an asset-reference
// field: every resolvable entry id plus every known Placeholder_Entry id.
const KNOWN_ASSET_IDS: string[] = [
  ...ASSET_INDEX.map((e) => e.id),
  ...ASSET_PLACEHOLDERS.map((p) => p.id),
];

// The set of paths that the Asset_Index actually maps to existing files.
const KNOWN_INDEXED_PATHS: ReadonlySet<string> = new Set(
  ASSET_INDEX.map((e) => e.path),
);

const knownAssetIdArb = fc.constantFrom(...KNOWN_ASSET_IDS);

/**
 * A schema-conforming content instance whose three asset-reference fields draw
 * only from known Asset_Index ids / placeholder ids. The non-reference content
 * is irrelevant to this property, so it is kept minimal.
 */
const contentArb = fc.record({
  profile: fc.record({ avatarAssetId: knownAssetIdArb }),
  projects: fc.array(fc.record({ assetId: knownAssetIdArb }), {
    minLength: 1,
    maxLength: 4,
  }),
  settings: fc.record({ defaultCharacterAssetId: knownAssetIdArb }),
});

/** Collect every value occupying an asset-reference field in the content. */
function assetReferenceValues(content: {
  profile: { avatarAssetId: string };
  projects: { assetId: string }[];
  settings: { defaultCharacterAssetId: string };
}): string[] {
  return [
    content.profile.avatarAssetId,
    ...content.projects.map((p) => p.assetId),
    content.settings.defaultCharacterAssetId,
  ];
}

function isPlaceholder(
  resolved: AssetEntry | AssetPlaceholder,
): resolved is AssetPlaceholder {
  return (resolved as AssetPlaceholder).placeholder === true;
}

describe("Asset_Index reference properties", () => {
  // Feature: portfolio-world-engine, Property 3: Asset references are logical
  // identifiers, never file paths — for any schema-conforming content instance,
  // every value occupying an asset-reference field (avatarAssetId, assetId,
  // defaultCharacterAssetId) is a logical Asset_Index id that either resolves
  // through the index or is a known Placeholder_Entry, and is never a
  // filesystem path into the assets/ folder.
  // Validates: Requirements 3.6
  it("Property 3: asset-reference fields are logical ids that resolve, never paths", () => {
    fc.assert(
      fc.property(contentArb, (content) => {
        for (const id of assetReferenceValues(content)) {
          // The id itself must be a logical identifier, not a path: it has no
          // path separator, no "assets/" prefix, and no file extension.
          expect(id.includes("/")).toBe(false);
          expect(id.startsWith("assets/")).toBe(false);
          expect(/\.(glb|gltf|fbx|obj)$/i.test(id)).toBe(false);

          // It resolves to an entry or a known placeholder — never a path to a
          // non-existent file.
          const resolved = getAsset(id);
          if (isPlaceholder(resolved)) {
            // A placeholder carries no path at all.
            expect("path" in resolved).toBe(false);
          } else {
            // A resolved entry maps only to a path the index knows exists.
            expect(KNOWN_INDEXED_PATHS.has(resolved.path)).toBe(true);
          }
          // In all cases the resolved object echoes the same logical id.
          expect(resolved.id).toBe(id);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
