import {
  BLOCK_BEVEL,
  BLOCK_BEVEL_SEGS,
  BLOCK_HALF,
  BLOCK_T,
  BLOCK_Z_TOP,
  FEMALE_BASE_T,
  PIN_R,
  PIN_SEGS,
  PIN_SPAN_EXTRA,
  PIN_Z,
  RAIL_BASE,
  RAIL_EMBED,
  RAIL_H,
  RAIL_TIP,
  RAIL_Z0,
  RAIL_Z1,
  SLOT_Z_BOTTOM,
} from './constants';
import type { Manifold, Scope, Vec2 } from './manifold';

/**
 * Frame on a parent face: P = rail centre on the face (x, y), N = outward normal,
 * S = across-rail direction. Local (s, t) maps to world (x, y). Always construct it from
 * the CURRENT parent face (see layout.ts); never store absolute coordinates.
 */
export class RailFrame {
  readonly P: Vec2;
  readonly N: Vec2;
  readonly S: Vec2;
  constructor(P: Vec2, N: Vec2, S: Vec2) {
    this.P = P;
    this.N = N;
    this.S = S;
  }
  xy(s: number, t: number): Vec2 {
    return [this.P[0] + this.S[0] * s + this.N[0] * t, this.P[1] + this.S[1] * s + this.N[1] * t];
  }
  bounds(s0: number, s1: number, t0: number, t1: number): { x0: number; x1: number; y0: number; y1: number } {
    const pts = [s0, s1].flatMap((s) => [t0, t1].map((t) => this.xy(s, t)));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
}

/** Male dovetail in (s, t): base 10 at the face, tip 16 at t = 5, embedded 0.6 into the parent. */
export function maleProfile(): Vec2[] {
  const b = RAIL_BASE / 2, t = RAIL_TIP / 2;
  return [[-b, -RAIL_EMBED], [b, -RAIL_EMBED], [b, 0], [t, RAIL_H], [-t, RAIL_H], [-b, 0]];
}

/** Female slot: male flank offset outward by tol (perpendicular), tip clearance + tol. */
export function femaleProfile(tol: number): Vec2[] {
  const b = RAIL_BASE / 2, t = RAIL_TIP / 2, h = RAIL_H;
  const slope = (t - b) / h;
  const off = tol * Math.sqrt(1 + slope ** 2);
  const hd = h + tol;
  const s0 = b + off;
  const s1 = b + slope * hd + off;
  return [[-s0, FEMALE_BASE_T], [s0, FEMALE_BASE_T], [s0, 0], [s1, hd], [-s1, hd], [-s0, 0]];
}

/** M3 pin hole through a rail/block pair, drilled across the rail (along S) at mid dovetail height. */
export function pinHole(s: Scope, m: Manifold, fr: RailFrame): Manifold {
  const p = fr.xy(0, RAIL_H / 2);
  const span = BLOCK_HALF + PIN_SPAN_EXTRA;
  const c = Math.abs(fr.S[0]) > 0.5
    ? s.cylX(PIN_R, [p[1], PIN_Z], p[0] - span, p[0] + span, PIN_SEGS)
    : s.cylY(PIN_R, [p[0], PIN_Z], p[1] - span, p[1] + span, PIN_SEGS);
  return s.cut(m, c);
}

/** Unions a male rail (z 10 -> 80) onto `parent` and drills the pin hole. Returns the new solid. */
export function addMaleRail(s: Scope, parent: Manifold, fr: RailFrame): Manifold {
  const rail = s.prismZ(maleProfile().map(([a, t]) => fr.xy(a, t)), RAIL_Z0, RAIL_Z1);
  return pinHole(s, s.union(parent, rail), fr);
}

/**
 * Adds the female slot block (z 0 -> zTop, TOL off the parent face, open at the bottom,
 * capped at RAIL_Z1 + tol as a gravity stop) and the pin hole. Returns the new solid.
 */
export function addFemaleBlock(s: Scope, module: Manifold, fr: RailFrame, tol: number, zTop = BLOCK_Z_TOP): Manifold {
  const { x0, x1, y0, y1 } = fr.bounds(-BLOCK_HALF, BLOCK_HALF, tol, BLOCK_T);
  const blk = s.box(x0, x1, y0, y1, 0, zTop, BLOCK_BEVEL, BLOCK_BEVEL_SEGS);
  const slot = s.prismZ(femaleProfile(tol).map(([a, t]) => fr.xy(a, t)), SLOT_Z_BOTTOM, RAIL_Z1 + tol);
  return pinHole(s, s.cut(s.union(module, blk), slot), fr);
}
