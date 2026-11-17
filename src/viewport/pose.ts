import { assemblyOffset } from '../geometry/placement';
import type { BBox, PartId } from '../geometry/types';

/** Blender-frame mesh for one part, as delivered by the geometry worker. */
export type PartMesh = { positions: Float32Array; indices: Uint32Array };
export type PartMeshes = Partial<Record<PartId, PartMesh>>;

export type Vec3 = [number, number, number];

/** Pose translation for transition progress t in [0, 1] (0 assembled, 1 exploded). */
export function poseOffset(id: PartId, t: number): Vec3 {
  const a = assemblyOffset(id, false);
  const b = assemblyOffset(id, true);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Axis-aligned bounds of a position buffer (Blender frame). Empty buffer gives a zero box. */
export function positionsBBox(positions: Float32Array): BBox {
  if (positions.length < 3) return { min: [0, 0, 0], max: [0, 0, 0] };
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k]!;
      if (v < min[k]!) min[k] = v;
      if (v > max[k]!) max[k] = v;
    }
  }
  return { min, max };
}

/** Combined bounds of several parts in their pose for t. */
export function sceneBBox(meshes: PartMeshes, t: number): BBox | null {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let any = false;
  for (const id of Object.keys(meshes) as PartId[]) {
    const m = meshes[id];
    if (!m || m.positions.length < 3) continue;
    const b = positionsBBox(m.positions);
    const o = poseOffset(id, t);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, b.min[k]! + o[k]!);
      max[k] = Math.max(max[k]!, b.max[k]! + o[k]!);
    }
    any = true;
  }
  return any ? { min, max } : null;
}

/** `80.0 × 59.8 × 100.0 mm` (width x, depth y, height z; one decimal). */
export function formatDims(bbox: BBox): string {
  const d = [0, 1, 2].map((k) => (bbox.max[k]! - bbox.min[k]!).toFixed(1));
  return `${d[0]} × ${d[1]} × ${d[2]} mm`;
}

/** `80.0 mm` */
export function formatLength(mm: number): string {
  return `${mm.toFixed(1)} mm`;
}

/** CSS-style cubic-bezier easing, x -> y, solved by bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const coord = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (coord(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return coord(y1, y2, (lo + hi) / 2);
  };
}

export const EASE = cubicBezier(0.22, 1, 0.36, 1);
/** Exploded transition length in seconds (SPEC: 150-250 ms). */
export const TRANSITION_S = 0.22;
