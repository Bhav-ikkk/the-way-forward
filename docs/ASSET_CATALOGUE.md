# Asset Catalogue — public/models

All models are self-contained GLBs (textures embedded) ready to load at runtime.
Curated from the owner's asset packs for the Environment Art Pass. Source packs:
animated-characters-kit, big-block-characters, building-kit, city-industrial-kit,
retro-urban-kit, roads-kit, survival-kit, small-animals, nature_kit, Furniture.

## Character (animated)
Converted from `animated-characters-kit` (FBX → glTF). Animation clips bind to
the player skeleton by bone name (verified: 31/31 idle bones matched).
- `player.glb` — skinned character (textured with skaterMaleA skin), 1 material "skin".
- `player_idle.glb` — clip **`Root|Idle`**
- `player_run.glb` — clip **`Root|Run`**
- `player_jump.glb` — clip **`Root|Jump`**
Swapping the player model = replace `player.glb` (keep the same skeleton/bone
names to reuse the clips). The model path is a single config constant.

## Chapter buildings (recommended mapping)
- Arrival Camp (wooden camp): `camp_hut.glb`, `camp_tent.glb`/`camp_tent_canvas.glb`, `campfire_pit.glb`, `bedroll.glb`
- Workshop (industrial): `bld_c.glb`/`bld_a.glb` + `workbench.glb`, `workbench_anvil.glb`, `workbench_grind.glb`, `barrel.glb`, `crate.glb`, `crate_large.glb`, `tool_hammer.glb`, `tool_axe.glb`, `woodpile.glb`, `log_pile.glb`, `pallet.glb`, `planks.glb`
- Library (stone): `bld_e.glb`/`bld_f.glb` (tinted) or building-kit pieces `bk_wall.glb`, `bk_wall_window.glb`, `bk_wall_door.glb`, `bk_roof.glb`, `bk_column.glb`, `bk_floor.glb`, `bk_stairs.glb`
- AI Laboratory (modern tech): `bld_l.glb`/`bld_m.glb` or `bld_tower_b.glb` (glass/modern)
- Observatory (tower): `bld_tower_a.glb`/`bld_tower_c.glb` or composed building-kit tower + dome
- Lighthouse: composed tapering tower (building-kit `bk_column`/`bk_wall` stacked) + beacon light (no literal lighthouse model exists)

## Roads & bridge (natural dirt aesthetic)
- `road_straight.glb`, `road_corner.glb`, `road_corner_inner.glb`, `road_corner_outer.glb`, `road_tile.glb`, `road_side.glb`, `road_center.glb`
- Bridge: `bridge_deck.glb`, `bridge_pillar.glb`, `bridge_pillar_wide.glb`

## Props / composition
- Camp/workshop: `barrel`, `barrel_open`, `crate`, `crate_large`, `chest`, `bucket`, `signpost_s`, `bedroll`, `campfire_stand`
- Resting/path: `bench_park.glb`, `lamp_post.glb`, `lamp_post_double.glb`, `fence_wood.glb`, `fence_gate.glb`, `fence_rail.glb`
- Nature: `tree_big.glb`, `tree_pine_big.glb`, `shrub.glb`, `s_tree.glb`, `s_tree_tall.glb`, `s_rock_a.glb`, `s_rock_b.glb` (plus existing nature_kit models)

## Ambient animals (small-animals)
`animal_bunny.glb`, `animal_deer.glb`, `animal_fox.glb`, `animal_cat.glb`,
`animal_dog.glb`, `animal_parrot.glb`, `animal_chick.glb`

## Legacy placeholder models (to be retired as real buildings replace them)
The earlier `build_*.glb` primitives and the simple `character.glb` remain until
the chapter structures are rebuilt with the models above.
