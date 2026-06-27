/**
 * Asset_Index data: the static id -> existing-file entry list and the
 * Placeholder_Entry list for needed-but-missing assets.
 *
 * Every `path` below was verified to point at a file that actually exists in
 * the repository `assets/` folder. Formats are resolved using the
 * GLB -> GLTF -> FBX -> OBJ preference: the most-preferred format present for a
 * given asset is chosen and recorded per entry (Requirement 5.4). The character
 * and graveyard packs ship binary `.glb` files, so those entries resolve to
 * "glb". The nature_kit pack ships binary glTF (`.glb`) files under its
 * "GLTF format" folder, which also resolves to "glb".
 *
 * Needed-but-missing assets (e.g. the main progression bridge) are recorded
 * ONLY as AssetPlaceholder records, never as path-bearing entries
 * (Requirement 5.3).
 *
 * See design.md "Data Models" -> Asset_Index mapping.
 */
import type { AssetEntry, AssetPlaceholder } from "./types";

/**
 * Starter set of resolved Asset_Index entries. All paths point to existing
 * files in the six allowed packs.
 */
export const ASSET_INDEX: AssetEntry[] = [
  // --- character pack (ships GLB) ---
  {
    id: "character.male.a",
    pack: "character",
    format: "glb",
    category: "character",
    label: "Male character A",
    path: "assets/character/Models/GLB format/character-male-a.glb",
  },
  {
    id: "character.male.b",
    pack: "character",
    format: "glb",
    category: "character",
    label: "Male character B",
    path: "assets/character/Models/GLB format/character-male-b.glb",
  },
  {
    id: "character.female.a",
    pack: "character",
    format: "glb",
    category: "character",
    label: "Female character A",
    path: "assets/character/Models/GLB format/character-female-a.glb",
  },
  {
    id: "character.female.b",
    pack: "character",
    format: "glb",
    category: "character",
    label: "Female character B",
    path: "assets/character/Models/GLB format/character-female-b.glb",
  },

  // --- graveyard pack (ships GLB) ---
  {
    id: "character.skeleton",
    pack: "graveyard",
    format: "glb",
    category: "character",
    label: "Skeleton character",
    path: "assets/graveyard/Models/GLB format/character-skeleton.glb",
  },
  {
    id: "world.road.segment",
    pack: "graveyard",
    format: "glb",
    category: "prop",
    label: "Road segment",
    path: "assets/graveyard/Models/GLB format/road.glb",
  },
  {
    id: "prop.lightpost.single",
    pack: "graveyard",
    format: "glb",
    category: "prop",
    label: "Single lightpost",
    path: "assets/graveyard/Models/GLB format/lightpost-single.glb",
  },

  // --- nature_kit pack (ships binary glTF as .glb under "GLTF format") ---
  {
    id: "nature.tree.oak",
    pack: "nature_kit",
    format: "glb",
    category: "nature",
    label: "Oak tree",
    path: "assets/nature_kit/Models/GLTF format/tree_oak.glb",
  },
  {
    id: "nature.rock.largeA",
    pack: "nature_kit",
    format: "glb",
    category: "nature",
    label: "Large rock A",
    path: "assets/nature_kit/Models/GLTF format/rock_largeA.glb",
  },
];

/**
 * Placeholder_Entry records for assets the world needs but that are not yet
 * resolvable to a confirmed file. These never carry a path (Requirement 5.3).
 */
export const ASSET_PLACEHOLDERS: AssetPlaceholder[] = [
  {
    id: "world.bridge.main",
    placeholder: true,
    description:
      "Bridge model representing progression between checkpoints; no matching asset confirmed in the library yet.",
  },
];
