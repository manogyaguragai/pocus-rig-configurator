import type { CrossSection, Manifold, ManifoldToplevel, Mat4, Vec3 } from 'manifold-3d';

export type { CrossSection, Manifold, Mat4, Vec3 };
export type ManifoldApi = ManifoldToplevel;
export type Axis = 'x' | 'y' | 'z';
export type Vec2 = [number, number];
export type MeshData = { positions: Float32Array; indices: Uint32Array };

/*
 * MEMORY OWNERSHIP
 * Manifold and CrossSection objects live in WASM memory and are NOT garbage collected;
 * every one needs .delete(). Convention:
 *  - Part builders never call .delete() and never touch raw `api.Manifold.*` / chained
 *    `.translate()` results directly. They create everything through a Scope, which
 *    tracks every object it hands out (including results of union/cut/translate...).
 *  - Scope methods never consume their inputs; inputs stay valid until dispose().
 *  - The one object that must outlive the Scope is the builder's return value. The
 *    *driver* (buildPart / withScope) calls scope.release(result) before dispose().
 *  - If you must use a raw Manifold method, wrap the result: scope.track(m.simplify()).
 */
let cached: Promise<ManifoldToplevel> | undefined;

/** Loads and caches manifold-3d. Works in Node (vitest), the browser and workers. */
export function loadManifold(): Promise<ManifoldToplevel> {
  if (cached) return cached;
  const p = (async () => {
    const mod = (await import('manifold-3d')).default;
    const inNode = typeof process !== 'undefined' && !!process.versions?.node;
    let api: ManifoldToplevel;
    if (inNode) {
      api = await mod();
    } else {
      // Vite emits the wasm as an asset and returns its URL; Node resolves it from disk by itself.
      const url = (await import('manifold-3d/manifold.wasm?url')).default;
      api = await mod({ locateFile: () => url });
    }
    api.setup();
    return api;
  })();
  cached = p;
  // A rejected load (network blip, bad wasm URL) must not be cached forever: allow a retry.
  p.catch(() => { if (cached === p) cached = undefined; });
  return p;
}

type Disposable = { delete(): void };

/** Arena for Manifold/CrossSection objects plus the shape helpers every part builder uses. */
export class Scope {
  private live = new Set<Disposable>();
  private closed = false;

  constructor(readonly api: ManifoldToplevel) {}

  track<T extends Disposable>(o: T): T {
    if (this.closed) throw new Error('Scope already disposed');
    this.live.add(o);
    return o;
  }

  /** Removes o from the arena so dispose() will not free it; the caller now owns it. */
  release<T extends Disposable>(o: T): T {
    this.live.delete(o);
    return o;
  }

  dispose(): void {
    this.closed = true;
    for (const o of this.live) o.delete();
    this.live.clear();
  }

  // ---- primitives (all results tracked) ----

  /**
   * Axis-aligned box. bevel > 0 rounds ALL 12 edges with radius `bevel` (the reference
   * bmesh bevel, offset = radius, `segs` segments per 90 degrees), built as the hull of
   * 8 corner spheres: no minkowski, one cheap convex hull. See ARCH.md for volume impact.
   */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, bevel = 0, segs = 3): Manifold {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    if (!(dx > 0 && dy > 0 && dz > 0)) throw new Error(`box: non-positive size ${dx} x ${dy} x ${dz}`);
    const { Manifold } = this.api;
    const r = Math.min(bevel, dx / 2, dy / 2, dz / 2);
    if (!(r > 0)) return this.translate(this.track(Manifold.cube([dx, dy, dz])), x0, y0, z0);
    const ball = this.track(Manifold.sphere(r, 4 * segs));
    const corners: Manifold[] = [];
    for (const x of [x0 + r, x1 - r])
      for (const y of [y0 + r, y1 - r])
        for (const z of [z0 + r, z1 - r]) corners.push(this.track(ball.translate(x, y, z)));
    return this.track(Manifold.hull(corners));
  }

  /** Tapered box centred on (cx, cy): bw x bd at z0, tw x td at z1. */
  frustum(cx: number, cy: number, z0: number, z1: number, bw: number, bd: number, tw: number, td: number): Manifold {
    const rect = this.track(this.api.CrossSection.square([bw, bd], true));
    const m = this.track(this.api.Manifold.extrude(rect, z1 - z0, 0, 0, [tw / bw, td / bd]));
    return this.track(m.translate(cx, cy, z0));
  }

  /**
   * Cylinder along `axis` from a0 to a1. `c` is the centre in the other two axes, same
   * semantics as the reference cyl(): z -> (x, y); y -> (x, z); x -> (y, z).
   */
  cyl(axis: Axis, r: number, c: Vec2, a0: number, a1: number, segs = 64): Manifold {
    const len = Math.abs(a1 - a0);
    const lo = Math.min(a0, a1);
    const z = this.track(this.api.Manifold.cylinder(len, r, r, segs));
    if (axis === 'z') return this.track(z.translate(c[0], c[1], lo));
    // z -> y: rotate -90 about X maps +z to +y; z -> x: rotate +90 about Y maps +z to +x.
    if (axis === 'y') return this.track(this.track(z.rotate(-90, 0, 0)).translate(c[0], lo, c[1]));
    return this.track(this.track(z.rotate(0, 90, 0)).translate(lo, c[0], c[1]));
  }
  cylX(r: number, c: Vec2, a0: number, a1: number, segs = 64): Manifold { return this.cyl('x', r, c, a0, a1, segs); }
  cylY(r: number, c: Vec2, a0: number, a1: number, segs = 64): Manifold { return this.cyl('y', r, c, a0, a1, segs); }
  cylZ(r: number, c: Vec2, a0: number, a1: number, segs = 64): Manifold { return this.cyl('z', r, c, a0, a1, segs); }

  /**
   * XY polygon extruded along Z from z0 to z1 via CrossSection. Winding is normalised, so
   * mirrored point lists (e.g. from a RailFrame with a flipped basis) are accepted.
   */
  prismZ(pts: readonly Vec2[], z0: number, z1: number): Manifold {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
      a += p[0] * q[1] - q[0] * p[1];
    }
    const ring = (a < 0 ? [...pts].reverse() : [...pts]).map((p) => [p[0], p[1]] as Vec2);
    const cs = this.track(new this.api.CrossSection([ring], 'Positive'));
    return this.track(this.track(this.api.Manifold.extrude(cs, z1 - z0)).translate(0, 0, z0));
  }

  // ---- booleans and transforms (functional: inputs are never modified) ----

  union(...ms: Manifold[]): Manifold {
    return this.track(this.api.Manifold.union(ms));
  }

  /** a minus every cutter. */
  cut(a: Manifold, ...cutters: Manifold[]): Manifold {
    return this.track(this.api.Manifold.difference([a, ...cutters]));
  }

  intersect(a: Manifold, b: Manifold): Manifold {
    return this.track(this.api.Manifold.intersection(a, b));
  }

  translate(m: Manifold, x: number, y: number, z: number): Manifold {
    return this.track(m.translate(x, y, z));
  }

  transform(m: Manifold, mat: Mat4): Manifold {
    return this.track(m.transform(mat));
  }

  /** Raw triangle data (x,y,z positions + indices), copied out of WASM memory. */
  meshData(m: Manifold): MeshData {
    const mesh = m.getMesh();
    const n = mesh.numProp;
    const positions = new Float32Array((mesh.vertProperties.length / n) * 3);
    for (let i = 0, v = 0; i < mesh.vertProperties.length; i += n, v += 3) {
      positions[v] = mesh.vertProperties[i]!;
      positions[v + 1] = mesh.vertProperties[i + 1]!;
      positions[v + 2] = mesh.vertProperties[i + 2]!;
    }
    return { positions, indices: new Uint32Array(mesh.triVerts) };
  }
}

/** Runs fn with a fresh Scope; the returned value is released, everything else freed (also on throw). */
export function withScope<T extends Disposable>(api: ManifoldToplevel, fn: (s: Scope) => T): T;
export function withScope<T>(api: ManifoldToplevel, fn: (s: Scope) => T, keep: (v: T) => Disposable[]): T;
export function withScope<T>(api: ManifoldToplevel, fn: (s: Scope) => T, keep?: (v: T) => Disposable[]): T {
  const s = new Scope(api);
  try {
    const v = fn(s);
    for (const o of keep ? keep(v) : [v as unknown as Disposable]) s.release(o);
    return v;
  } finally {
    s.dispose();
  }
}

/** True when the solid is a valid, non-empty manifold. */
export function isValid(m: Manifold): boolean {
  return m.status() === 'NoError' && !m.isEmpty() && m.volume() > 0;
}
