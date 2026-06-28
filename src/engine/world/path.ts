import * as pc from "playcanvas";

/**
 * A smooth, gently-curving journey path built from a Catmull-Rom spline.
 *
 * The path threads through a handful of control points and produces S-curves so
 * that upcoming landmarks stay partially hidden behind bends and scenery until
 * the player rounds each curve. It is intentionally pure math (plain numbers
 * internally) and only constructs `pc.Vec3` at the boundary, so it is cheap to
 * sample every frame and trivial to unit-test.
 *
 * Coordinates live on the XZ ground plane (y is always 0 for the centreline);
 * the journey winds along +Z away from the spawn clearing.
 */

/** A point sampled on the path: world position + normalised travel tangent. */
export interface PathSample {
  /** World-space position on the centreline (y = 0). */
  position: pc.Vec3;
  /** Normalised forward tangent (direction of travel) on the XZ plane. */
  tangent: pc.Vec3;
}

/** A 2D control point on the ground plane. */
interface CP {
  x: number;
  z: number;
}

/** Uniform Catmull-Rom basis for a single component. */
function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** Derivative of the Catmull-Rom basis (for tangents). */
function crTangent(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  return (
    0.5 *
    (-p0 +
      p2 +
      2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
      3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2)
  );
}

/** A sampleable journey path. */
export class Path {
  private readonly pts: CP[];
  private readonly segments: number;
  private readonly cachedLength: number;
  /** Cumulative arc-length table over fine samples for even spacing. */
  private readonly arc: { t: number; d: number }[];

  constructor(controlPoints: ReadonlyArray<readonly [number, number]>) {
    if (controlPoints.length < 2) {
      throw new Error("Path requires at least 2 control points");
    }
    this.pts = controlPoints.map(([x, z]) => ({ x, z }));
    this.segments = this.pts.length - 1;

    // Build a cumulative arc-length table so getEvenlySpacedPoints and the
    // length estimate are reasonably accurate despite non-uniform parameter
    // speed along the spline.
    const STEPS = 400;
    this.arc = [];
    let prev = this.evalAt(0);
    let acc = 0;
    this.arc.push({ t: 0, d: 0 });
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      const cur = this.evalAt(t);
      acc += Math.hypot(cur.x - prev.x, cur.z - prev.z);
      this.arc.push({ t, d: acc });
      prev = cur;
    }
    this.cachedLength = acc;
  }

  /** Clamp a control-point index to the valid range (clamped endpoints). */
  private idx(i: number): CP {
    const j = Math.max(0, Math.min(this.pts.length - 1, i));
    return this.pts[j];
  }

  /** Evaluate the raw centreline position at global parameter t in [0, 1]. */
  private evalAt(t: number): CP {
    const clamped = Math.max(0, Math.min(1, t));
    const scaled = clamped * this.segments;
    let seg = Math.floor(scaled);
    if (seg >= this.segments) seg = this.segments - 1;
    const local = scaled - seg;

    const p0 = this.idx(seg - 1);
    const p1 = this.idx(seg);
    const p2 = this.idx(seg + 1);
    const p3 = this.idx(seg + 2);

    return {
      x: cr(p0.x, p1.x, p2.x, p3.x, local),
      z: cr(p0.z, p1.z, p2.z, p3.z, local),
    };
  }

  /** Evaluate the raw tangent (unnormalised) at global parameter t. */
  private tangentAt(t: number): CP {
    const clamped = Math.max(0, Math.min(1, t));
    const scaled = clamped * this.segments;
    let seg = Math.floor(scaled);
    if (seg >= this.segments) seg = this.segments - 1;
    const local = scaled - seg;

    const p0 = this.idx(seg - 1);
    const p1 = this.idx(seg);
    const p2 = this.idx(seg + 1);
    const p3 = this.idx(seg + 2);

    return {
      x: crTangent(p0.x, p1.x, p2.x, p3.x, local),
      z: crTangent(p0.z, p1.z, p2.z, p3.z, local),
    };
  }

  /**
   * Sample the path at parameter `t` in [0, 1].
   * Returns the world position (y = 0) and the normalised forward tangent.
   */
  sample(t: number): PathSample {
    const p = this.evalAt(t);
    const d = this.tangentAt(t);
    const len = Math.hypot(d.x, d.z) || 1;
    return {
      position: new pc.Vec3(p.x, 0, p.z),
      tangent: new pc.Vec3(d.x / len, 0, d.z / len),
    };
  }

  /** Estimated total arc length of the path in world units. */
  length(): number {
    return this.cachedLength;
  }

  /**
   * Sample the path by ARC-LENGTH distance `s` (world units, 0..length).
   *
   * This is the clean distance->sample API the on-rails movement model uses:
   * the player position is tracked as a distance `s` along the spline, and each
   * frame we ask for the world position + travel tangent at that distance.
   * Distances outside [0, length] are clamped so the player can never overshoot
   * the start or end of the journey.
   */
  sampleByDistance(s: number): PathSample {
    return this.sample(this.tForDistance(s));
  }

  /**
   * Map a parameter `t` in [0, 1] to its arc-length distance (world units).
   *
   * Inverse of {@link tForDistance}. Used to convert authored placements (which
   * are expressed as `t` along the spline, e.g. the spawn point) into the
   * distance space the on-rails movement runs in.
   */
  distanceForT(t: number): number {
    const target = Math.max(0, Math.min(1, t));
    const steps = this.arc.length - 1;
    const scaled = target * steps;
    let lo = Math.floor(scaled);
    if (lo >= steps) return this.cachedLength;
    if (lo < 0) lo = 0;
    const frac = scaled - lo;
    const a = this.arc[lo];
    const b = this.arc[lo + 1];
    return a.d + (b.d - a.d) * frac;
  }

  /**
   * Map a desired arc-length distance (0..length) back to a parameter t.
   * Used internally to space points evenly regardless of spline speed.
   */
  private tForDistance(dist: number): number {
    const target = Math.max(0, Math.min(this.cachedLength, dist));
    // Binary search the cumulative table.
    let lo = 0;
    let hi = this.arc.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.arc[mid].d < target) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return 0;
    const a = this.arc[lo - 1];
    const b = this.arc[lo];
    const span = b.d - a.d || 1;
    const frac = (target - a.d) / span;
    return a.t + (b.t - a.t) * frac;
  }

  /**
   * Return `count` samples spaced (approximately) evenly by arc length from the
   * start to the end of the path. Handy for laying path segments / lanterns.
   */
  getEvenlySpacedPoints(count: number): PathSample[] {
    const n = Math.max(2, count);
    const out: PathSample[] = [];
    for (let i = 0; i < n; i++) {
      const dist = (i / (n - 1)) * this.cachedLength;
      out.push(this.sample(this.tForDistance(dist)));
    }
    return out;
  }
}

/** Convenience factory mirroring the rest of the world module style. */
export function createPath(
  controlPoints: ReadonlyArray<readonly [number, number]>,
): Path {
  return new Path(controlPoints);
}
