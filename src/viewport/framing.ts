import type { BBox } from '../geometry/types';
import type { Vec3 } from './pose';

/** Default 3/4 view direction from the target to the camera (Z up, front is -y). */
export const VIEW_DIR: Vec3 = [0.5, -0.82, 0.46];
export const FOV_DEG = 32;

/** Bounds between the assembled and exploded extents: `w` = 0 is assembled, 1 is exploded. */
export function blendBBox(a: BBox, b: BBox, w: number): BBox {
  const mix = (x: Vec3, y: Vec3): Vec3 => [x[0] + (y[0] - x[0]) * w, x[1] + (y[1] - x[1]) * w, x[2] + (y[2] - x[2]) * w];
  return { min: mix(a.min, b.min), max: mix(a.max, b.max) };
}

export type Framing = { target: Vec3; position: Vec3; distance: number };

/**
 * Camera pose that fits the bbox, using its bounding sphere, in a viewport of the given
 * aspect (width / height). Narrow aspects are limited by the horizontal field of view, so a
 * portrait phone gets a closer camera than the sphere radius alone would suggest.
 */
export function frameBBox(bbox: BBox, aspect: number, fovDeg = FOV_DEG, pad = 1.08, dir: Vec3 = VIEW_DIR): Framing {
  const target: Vec3 = [
    (bbox.min[0] + bbox.max[0]) / 2,
    (bbox.min[1] + bbox.max[1]) / 2,
    (bbox.min[2] + bbox.max[2]) / 2,
  ];
  const dx = bbox.max[0] - bbox.min[0];
  const dy = bbox.max[1] - bbox.min[1];
  const dz = bbox.max[2] - bbox.min[2];
  // A 3/4 view of a box fills about 0.8 of its bounding sphere, so shrink the sphere a little.
  const r = 0.5 * Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.82;
  const a = Math.max(0.2, aspect);
  const vHalf = (fovDeg * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * a);
  const distance = (Math.max(r / Math.sin(vHalf), r / Math.sin(hHalf)) * pad) || 300;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  const position: Vec3 = [
    target[0] + (dir[0] / len) * distance,
    target[1] + (dir[1] / len) * distance,
    target[2] + (dir[2] / len) * distance,
  ];
  return { target, position, distance };
}

/** Smallest camera distance at which every corner of `bbox` projects within `fill` of the half-extent, on both axes. */
function fitDistance(bbox: BBox, target: Vec3, aspect: number, fovDeg: number, dir: Vec3, fillV: number, fillH: number): number {
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  const f: Vec3 = [dir[0] / len, dir[1] / len, dir[2] / len]; // target -> camera
  // Camera basis: right = up x f (normalised), up' = f x right, with world up = +z.
  let rx = -f[1], ry = f[0], rz = 0; // z-up cross f
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  const ux = f[1] * rz - f[2] * ry;
  const uy = f[2] * rx - f[0] * rz;
  const uz = f[0] * ry - f[1] * rx;
  const tv = Math.tan((fovDeg * Math.PI) / 360);
  const th = tv * Math.max(0.2, aspect);
  let d = 0;
  for (const x of [bbox.min[0], bbox.max[0]])
    for (const y of [bbox.min[1], bbox.max[1]])
      for (const z of [bbox.min[2], bbox.max[2]]) {
        const p: Vec3 = [x - target[0], y - target[1], z - target[2]];
        const depth = p[0] * f[0] + p[1] * f[1] + p[2] * f[2]; // toward the camera
        const px = Math.abs(p[0] * rx + p[1] * ry + p[2] * rz);
        const py = Math.abs(p[0] * ux + p[1] * uy + p[2] * uz);
        d = Math.max(d, depth + px / (th * fillH), depth + py / (tv * fillV));
      }
  return d;
}

/** Share of the viewport height the assembled rig fills at the initial framing. */
export const ASSEMBLED_FILL = 0.8;
/** Bounding-box corners of the exploded pose may reach this share of the half-extent; real silhouettes are about 20% smaller than their box corners, so the parts stay inside the frame. */
export const EXPLODED_FIT = 1.1;

/**
 * Initial camera: the assembled rig fills about 60-70% of the viewport height (bounding-box corners at 0.8), unless the
 * exploded pose would then leave the frame, in which case the camera backs off just enough to
 * keep it in view. Uses exact corner projection, not a bounding sphere.
 */
export function frameRig(assembled: BBox, exploded: BBox, aspect: number, fovDeg = FOV_DEG, dir: Vec3 = VIEW_DIR): Framing {
  const target = frameBBox(blendBBox(assembled, exploded, 0.3), aspect, fovDeg, 1, dir).target;
  const dA = fitDistance(assembled, target, aspect, fovDeg, dir, ASSEMBLED_FILL, 0.9);
  const dE = fitDistance(exploded, target, aspect, fovDeg, dir, EXPLODED_FIT, EXPLODED_FIT);
  const distance = Math.max(dA, dE) || 300;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  const position: Vec3 = [
    target[0] + (dir[0] / len) * distance,
    target[1] + (dir[1] / len) * distance,
    target[2] + (dir[2] / len) * distance,
  ];
  return { target, position, distance };
}

/** Fraction of the viewport height a bbox spans when seen from `framing` (corner projection, for tests and checks). */
export function projectedHeightFill(bbox: BBox, framing: Framing, fovDeg = FOV_DEG): number {
  const cam = framing.position;
  const f: Vec3 = [cam[0] - framing.target[0], cam[1] - framing.target[1], cam[2] - framing.target[2]];
  const fl = Math.hypot(...f);
  const n: Vec3 = [f[0] / fl, f[1] / fl, f[2] / fl];
  const rl = Math.hypot(n[1], n[0]) || 1;
  const r: Vec3 = [-n[1] / rl, n[0] / rl, 0];
  const u: Vec3 = [n[1] * r[2] - n[2] * r[1], n[2] * r[0] - n[0] * r[2], n[0] * r[1] - n[1] * r[0]];
  const tv = Math.tan((fovDeg * Math.PI) / 360);
  let lo = Infinity, hi = -Infinity;
  for (const x of [bbox.min[0], bbox.max[0]])
    for (const y of [bbox.min[1], bbox.max[1]])
      for (const z of [bbox.min[2], bbox.max[2]]) {
        const p: Vec3 = [x - cam[0], y - cam[1], z - cam[2]];
        const depth = -(p[0] * n[0] + p[1] * n[1] + p[2] * n[2]);
        const v = (p[0] * u[0] + p[1] * u[1] + p[2] * u[2]) / depth / tv; // -1..1 over the height
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
  return (hi - lo) / 2;
}
