// Physics integration boundary (src/engine/physics).
//
// Rapier is loaded exclusively through the async `createPhysics` factory's
// dynamic import, so importing this module never pulls WASM onto the server or
// into unit tests. The rest of the engine talks to physics only through the
// plain-data {@link Physics} handle.

export { createPhysics } from "./RapierPhysics";
export type { Physics, Vec3Like, MoveResult } from "./RapierPhysics";
