import type { BBox } from '../geometry/types';
import { formatLength, type Vec3 } from './pose';

/** Default view direction (target to camera, Z up); kept local so this module stays pure. */
const DEFAULT_VIEW: Vec3 = [0.5, -0.82, 0.46];

export type DimLine = {
  axis: 'x' | 'y' | 'z';
  /** dimension line end points */
  a: Vec3;
  b: Vec3;
  /** extension lines, from just off the part to just past the dimension line */
  ext: [Vec3, Vec3][];
  /** oblique end ticks, one segment per end */
  ticks: [Vec3, Vec3][];
  /** label anchor (middle of the dimension line) */
  mid: Vec3;
  label: string;
};

const add = (p: Vec3, d: Vec3, s: number): Vec3 => [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s];

/** Offset of the dimension lines from the part, scaled to its size but kept in a sane range. */
export function dimOffset(bbox: BBox): number {
  const m = Math.max(bbox.max[0] - bbox.min[0], bbox.max[1] - bbox.min[1], bbox.max[2] - bbox.min[2]);
  return Math.min(16, Math.max(7, m * 0.09));
}

/**
 * Which vertical edge of the bbox carries the height dimension: the one that faces the camera
 * unless its dimension line would run through a neighbouring part, in which case the best free
 * edge wins. Returns the edge's outward x sign and its y side (-1 front, +1 back).
 */
export function heightEdge(bbox: BBox, others: BBox[] = [], view: Vec3 = DEFAULT_VIEW): { sx: -1 | 1; sy: -1 | 1 } {
  const off = dimOffset(bbox);
  const pad = 2;
  let best = { sx: -1 as -1 | 1, sy: -1 as -1 | 1 };
  let bestScore = -Infinity;
  for (const sx of [1, -1] as const) {
    for (const sy of [-1, 1] as const) {
      const x = (sx > 0 ? bbox.max[0] : bbox.min[0]) + sx * off;
      const y = sy > 0 ? bbox.max[1] : bbox.min[1];
      const hit = others.some(
        (o) =>
          x >= o.min[0] - pad &&
          x <= o.max[0] + pad &&
          y >= o.min[1] - pad &&
          y <= o.max[1] + pad &&
          o.max[2] > bbox.min[2] &&
          o.min[2] < bbox.max[2],
      );
      const score = sx * view[0] + sy * view[1] - (hit ? 100 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = { sx, sy };
      }
    }
  }
  return best;
}

/**
 * Caliper-style dimension lines for a part's bbox in its local frame. Widths run along the
 * front bottom edge, depths along the right bottom edge and heights up the vertical edge chosen by `heightEdge`, all
 * offset outward with extension lines, so nothing crosses the part itself.
 */
export function dimensionLayout(bbox: BBox, others: BBox[] = [], view: Vec3 = DEFAULT_VIEW): DimLine[] {
  const { min, max } = bbox;
  const off = dimOffset(bbox);
  const over = off * 0.22; // extension line overshoot past the dimension line
  const gap = 1.5; // extension line starts just off the part
  const tick = Math.min(3.2, off * 0.3);

  const make = (axis: 'x' | 'y' | 'z', a0: Vec3, b0: Vec3, out: Vec3, len: number): DimLine => {
    const along: Vec3 = [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]];
    const l = Math.hypot(...along) || 1;
    const u: Vec3 = [along[0] / l, along[1] / l, along[2] / l];
    const a = add(a0, out, off);
    const b = add(b0, out, off);
    const ext: [Vec3, Vec3][] = [a0, b0].map((p) => [add(p, out, gap), add(p, out, off + over)] as [Vec3, Vec3]);
    // slash direction: halfway between the line direction and the outward direction
    const s: Vec3 = [u[0] + out[0], u[1] + out[1], u[2] + out[2]];
    const sl = Math.hypot(...s) || 1;
    const sd: Vec3 = [s[0] / sl, s[1] / sl, s[2] / sl];
    const ticks: [Vec3, Vec3][] = [a, b].map((p) => [add(p, sd, -tick), add(p, sd, tick)] as [Vec3, Vec3]);
    const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    return { axis, a, b, ext, ticks, mid, label: formatLength(len) };
  };

  const h = heightEdge(bbox, others, view);
  const ex = h.sx > 0 ? max[0] : min[0];
  const ey = h.sy > 0 ? max[1] : min[1];
  return [
    make('x', [min[0], min[1], min[2]], [max[0], min[1], min[2]], [0, -1, 0], max[0] - min[0]),
    make('y', [max[0], min[1], min[2]], [max[0], max[1], min[2]], [1, 0, 0], max[1] - min[1]),
    make('z', [ex, ey, min[2]], [ex, ey, max[2]], [h.sx, 0, 0], max[2] - min[2]),
  ];
}
