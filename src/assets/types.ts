/**
 * Asset_Index types.
 *
 * The Asset_Index maps stable, format-independent logical identifiers to files
 * that ALREADY EXIST in the repository `assets/` Asset_Library. Identifiers are
 * independent of file format so the backing file can be swapped without
 * changing the id other systems reference.
 *
 * See design.md "Components and Interfaces" -> Asset_Index (src/assets).
 */

/**
 * Model file formats the Render_Engine can consume, listed here in the order of
 * the GLB -> GLTF -> FBX -> OBJ preference. The resolved format is recorded per
 * entry because format availability varies by pack (Requirement 5.4).
 */
export type ModelFormat = "glb" | "gltf" | "fbx" | "obj";

/**
 * The six existing Kenney asset packs under `assets/`. The Asset_Index
 * references only these packs (Requirement 5.2). Names match the on-disk
 * folder names exactly (including casing).
 */
export type AssetPack =
  | "character"
  | "Furniture"
  | "graveyard"
  | "nature_kit"
  | "prototypes"
  | "small-animals";

/**
 * A resolved asset entry mapping a logical id to an existing file in the
 * Asset_Library.
 */
export interface AssetEntry {
  /** Format-independent logical id (Requirement 5.5), e.g. "character.male.a". */
  id: string;
  /** One of the six existing packs (Requirement 5.2). */
  pack: AssetPack;
  /** Path under `assets/` to an EXISTING file (Requirement 5.1). */
  path: string;
  /** Resolved format for this entry (Requirement 5.4). */
  format: ModelFormat;
  /** Optional human-readable name. */
  label?: string;
  /** Optional grouping (e.g. "character", "prop", "nature"). */
  category?: string;
}

/**
 * A Placeholder_Entry recorded for a needed-but-missing asset. A placeholder
 * never carries a path to a non-existent file (Requirement 5.3).
 */
export interface AssetPlaceholder {
  /** Logical id the placeholder reserves. */
  id: string;
  /** Discriminant marking this as a Placeholder_Entry. */
  placeholder: true;
  /** Why the asset is needed and why it is not yet resolvable. */
  description: string;
}
