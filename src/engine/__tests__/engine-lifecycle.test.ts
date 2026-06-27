// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup } from "@testing-library/react";

/**
 * Unit tests for the Render_Engine lifecycle (Task 5.2, lifecycle half).
 *
 * Canvas/WebGL are mocked: this file opts into the happy-dom environment for a
 * DOM, and the `playcanvas` module is stubbed via `vi.mock` so no real WebGL
 * context is ever created. The stub Application records its instances and
 * exposes `start`/`destroy` spies.
 *
 * Asserts that `createEngine` creates and starts an engine instance and that
 * `dispose()` destroys it, and that mounting `EngineMount` creates an instance
 * while unmounting calls `dispose`/`destroy`.
 *
 * Physics is disabled here (`enablePhysics: false`) so the Rapier WASM module
 * is never dynamically imported during the unit run — keeping these lifecycle
 * tests fast and free of any browser/WASM dependency.
 *
 * _Requirements: 7.1, 7.3, 7.4, 7.5_
 */

/** Records every stub Application constructed, so tests can count instances. */
const instances: Array<{ start: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> }> = [];
const startSpy = vi.fn();
const destroySpy = vi.fn();

vi.mock("playcanvas", () => {
  // Minimal stubs standing in for the pc.* APIs touched at createEngine /
  // module-eval time — no real WebGL context is ever created. The stub
  // Application records its instances and exposes start/destroy spies, plus the
  // handful of methods/objects createEngine + buildWorld + the controller call.

  // A lightweight Entity that supports the chained transform/component calls
  // used while building the handcrafted world.
  class Entity {
    name: unknown;
    constructor(name?: unknown) {
      this.name = name;
    }
    addComponent() {
      return {};
    }
    addChild() {}
    setLocalPosition() {}
    setLocalScale() {}
    setLocalEulerAngles() {}
    setEulerAngles() {}
    lookAt() {}
    getLocalPosition() {
      return { x: 0, y: 0, z: 0 };
    }
  }

  class Color {
    r: number;
    g: number;
    b: number;
    constructor(r = 0, g = 0, b = 0) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }

  class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  class StandardMaterial {
    diffuse: unknown;
    emissive: unknown;
    opacity = 1;
    blendType = 0;
    update() {}
  }

  class Mouse {
    constructor(_el?: unknown) {}
  }
  class Keyboard {
    constructor(_el?: unknown) {}
    isPressed() {
      return false;
    }
  }

  // Minimal stub standing in for pc.Application — no WebGL context needed.
  class Application {
    canvas: unknown;
    options: unknown;
    start = startSpy;
    destroy = destroySpy;
    scene = { ambientLight: new Color() };
    graphicsDevice = { maxPixelRatio: 1 };
    keyboard = new Keyboard();
    mouse = new Mouse();
    root = new Entity("root");
    assets = {
      // Never invokes the callback, so no async model wiring runs in tests.
      loadFromUrl: () => {},
    };
    constructor(canvas: unknown, options: unknown) {
      this.canvas = canvas;
      this.options = options;
      instances.push(this);
    }
    setCanvasFillMode() {}
    setCanvasResolution() {}
    resizeCanvas() {}
    on() {}
    off() {}
  }

  return {
    // `AppBase` is only referenced as a type in source; alias it to the stub.
    Application,
    AppBase: Application,
    Entity,
    Color,
    Vec3,
    StandardMaterial,
    Mouse,
    Keyboard,
    math: { RAD_TO_DEG: 180 / Math.PI, DEG_TO_RAD: Math.PI / 180, lerp: () => 0 },
    FILLMODE_FILL_WINDOW: "FILLMODE_FILL_WINDOW",
    RESOLUTION_AUTO: "RESOLUTION_AUTO",
    BLEND_NORMAL: 2,
    KEY_W: 87,
    KEY_A: 65,
    KEY_S: 83,
    KEY_D: 68,
    KEY_UP: 38,
    KEY_DOWN: 40,
    KEY_LEFT: 37,
    KEY_RIGHT: 39,
  };
});

// Stub the physics module so the `EngineMount` lifecycle tests (which render
// the real component and therefore create the engine with physics enabled by
// default) never dynamically import Rapier or its WASM. `createPhysics` returns
// a promise that never resolves, so no physics work runs during these tests —
// they stay focused purely on the create/dispose lifecycle. The two direct
// `createEngine` tests below pass `{ enablePhysics: false }` and so never even
// call this factory.
vi.mock("../physics", () => ({
  createPhysics: vi.fn(() => new Promise(() => {})),
}));

// Imported AFTER the mock is declared so they pick up the stubbed module.
import { createEngine } from "../createEngine";
import { EngineMount } from "../EngineMount";

beforeEach(() => {
  instances.length = 0;
  startSpy.mockClear();
  destroySpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("createEngine lifecycle", () => {
  it("creates and starts an engine instance bound to the canvas", () => {
    const canvas = document.createElement("canvas");
    const handle = createEngine(canvas, { enablePhysics: false });

    expect(handle.app).toBeDefined();
    expect(instances).toHaveLength(1);
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it("disposes the instance by destroying the engine (Req 7.3)", () => {
    const canvas = document.createElement("canvas");
    const handle = createEngine(canvas, { enablePhysics: false });

    expect(destroySpy).not.toHaveBeenCalled();
    handle.dispose();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});

describe("EngineMount lifecycle", () => {
  it("creates an engine instance on mount and renders a canvas", () => {
    const { container } = render(createElement(EngineMount));

    expect(container.querySelector("canvas")).not.toBeNull();
    // The client-only useEffect ran and created exactly one engine instance.
    expect(instances).toHaveLength(1);
  });

  it("disposes the engine (destroy) on unmount (Req 7.3)", () => {
    const { unmount } = render(createElement(EngineMount));
    expect(destroySpy).not.toHaveBeenCalled();

    unmount();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
