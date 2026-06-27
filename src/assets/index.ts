/**
 * Asset_Index public surface.
 *
 * A lightweight, static index over the entry list in `assets.data.ts`. It
 * exposes a simple `getAsset(id)` lookup and a pure `findBrokenEntries`
 * integrity helper. References are always logical ids, never file paths, and a
 * lookup never returns a path to a non-existent file.
 *
 * See design.md "Components and Interfaces" -> Asset_Index (src/assets).
 */
import { ASSET_INDEX, ASSET_PLACEHOLDERS } from "./assets.data";
import type { AssetEntry, AssetPack, AssetPlaceholder } from "./types";

export type { AssetEntry, AssetPlaceholder, AssetPack, ModelFormat } from "./types";
export { ASSET_INDEX, ASSET_PLACEHOLDERS } from "./assets.data";

/** The six packs the Asset_Index is allowed to reference (Requirement 5.2). */
export const ALLOWED_PACKS: readonly AssetPack[] = [
  "character",
  "Furniture",
  "graveyard",
  "nature_kit",
  "prototypes",
  "small-animals",
];

const ALLOWED_PACKS_SET: ReadonlySet<string> = new Set(ALLOWED_PACKS);

// Index by id once for O(1) lookups. Resolved entries take precedence; declared
// placeholders are kept separately so they can be returned as-is.
const ENTRY_BY_ID: ReadonlyMap<string, AssetEntry> = new Map(
  ASSET_INDEX.map((entry) => [entry.id, entry]),
);
const PLACEHOLDER_BY_ID: ReadonlyMap<string, AssetPlaceholder> = new Map(
  ASSET_PLACEHOLDERS.map((placeholder) => [placeholder.id, placeholder]),
);

/**
 * Resolve a logical asset id. Returns a resolved {@link AssetEntry} when the id
 * maps to an existing file, otherwise an {@link AssetPlaceholder}. Unknown ids
 * surface as a placeholder-style "unresolved id" result so callers can render a
 * fallback. This function never returns a path to a non-existent file
 * (Requirement 5.3).
 */
export function getAsset(id: string): AssetEntry | AssetPlaceholder {
  const entry = ENTRY_BY_ID.get(id);
  if (entry) {
    return entry;
  }

  const placeholder = PLACEHOLDER_BY_ID.get(id);
  if (placeholder) {
    return placeholder;
  }

  return {
    id,
    placeholder: true,
    description: `Unresolved asset id "${id}": no matching entry or placeholder in the Asset_Index.`,
  };
}

/**
 * Pure integrity helper used by tests/tooling. Returns the ids of non-placeholder
 * entries that are "broken": their mapped file is absent from `knownFiles`, or
 * their pack is not one of the six allowed packs. Placeholders carry no path and
 * are never reported (Requirement 5.1, 5.2, 5.3).
 *
 * @param entries Asset entries to check.
 * @param knownFiles Set of known Asset_Library file paths (as they appear in
 *   each entry's `path`).
 */
export function findBrokenEntries(
  entries: AssetEntry[],
  knownFiles: Set<string>,
): string[] {
  const broken: string[] = [];
  for (const entry of entries) {
    const packAllowed = ALLOWED_PACKS_SET.has(entry.pack);
    const fileExists = knownFiles.has(entry.path);
    if (!packAllowed || !fileExists) {
      broken.push(entry.id);
    }
  }
  return broken;
}
