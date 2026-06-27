// Render_Engine integration boundary (src/engine).
//
// This is the only module the App_Framework reaches the engine through. Engine
// code stays behind the client-only Engine_Mount and the createEngine factory,
// so browser-only globals are never touched on the server (Requirement 7.1,
// 7.4, 7.6).

export { createEngine } from "./createEngine";
export type {
  EngineHandle,
  CreateEngineOptions,
  CheckpointChangeHandler,
} from "./createEngine";
export type { CheckpointInfo, WelcomeInfo } from "./world/types";
export { EngineMount } from "./EngineMount";
