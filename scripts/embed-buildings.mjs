// Embed the prototypes building-kit pieces (walls/doors/floors/columns/roof
// shapes) into self-contained GLBs under public/models. The prototypes pack
// references an external Textures/colormap.png; reading with NodeIO resolves it
// relative to the source and writeBinary embeds it — same approach used for the
// character models. Node-only utility, not part of the build.
import { NodeIO } from "@gltf-transform/core";
import { writeFileSync } from "node:fs";

const io = new NodeIO();
const SRC = "assets/prototypes/Models/GLB format";

const JOBS = [
  ["wall.glb", "build_wall.glb"],
  ["wall-corner.glb", "build_wall_corner.glb"],
  ["wall-doorway.glb", "build_wall_door.glb"],
  ["wall-window-large.glb", "build_wall_window.glb"],
  ["floor-square.glb", "build_floor.glb"],
  ["door-rotate.glb", "build_door.glb"],
  ["column.glb", "build_column.glb"],
  ["shape-cylinder.glb", "build_cylinder.glb"],
  ["shape-hexagon.glb", "build_hexagon.glb"],
  ["shape-slope.glb", "build_roof.glb"],
  ["stairs.glb", "build_stairs.glb"],
  ["shape-cube.glb", "build_cube.glb"],
];

for (const [src, out] of JOBS) {
  const doc = await io.read(`${SRC}/${src}`);
  const glb = await io.writeBinary(doc);
  writeFileSync(`public/models/${out}`, Buffer.from(glb));
  console.log(`embedded ${src} -> public/models/${out} (${Math.round(glb.length / 1024)}KB)`);
}
