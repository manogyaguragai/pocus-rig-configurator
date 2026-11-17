import { PLATE_Z0 } from './constants';
import type { Manifold, Mat4, Scope, Vec3 } from './manifold';
import type { BBox, PartId } from './types';

/** Lifts the assembly so the plate bottom sits on z = 0 (ref: -PLATE z0 = 35). Rig parts only. */
export const ASSEMBLY_LIFT_Z = -PLATE_Z0;

/** SPEC 6 / ref `explode` table, Blender coords. Calibration parts have no explode. */
export const EXPLODE_OFFSETS: Readonly<Record<PartId, Vec3>> = {
  holster: [0, -60, 25],
  caddy: [45, -60, 25],
  gloveTube: [-45, -60, 25],
  gloveBox: [-45, -60, 25],
  plate: [0, 0, 0],
  vclamp: [0, 45, 0],
  calibMale: [0, 0, 0],
  calibFemaleLo: [0, 0, 0],
  calibFemale: [0, 0, 0],
  calibFemaleHi: [0, 0, 0],
};

const isCalib = (id: PartId) => id.startsWith('calib');

/**
 * Translation taking a builder-frame solid to its viewport pose. Rig parts: +ASSEMBLY_LIFT_Z
 * (plus the explode offset when exploded). Calibration parts: identity, which is their
 * assembled (mating) pose; the reference's x += 170 was only a scene layout.
 */
export function assemblyOffset(id: PartId, exploded: boolean): Vec3 {
  if (isCalib(id)) return [0, 0, 0];
  const e = exploded ? EXPLODE_OFFSETS[id] : ([0, 0, 0] as Vec3);
  return [e[0], e[1], e[2] + ASSEMBLY_LIFT_Z];
}

type Rot = readonly [number, number, number, number, number, number, number, number, number]; // row-major

const IDENTITY: Rot = [1, 0, 0, 0, 1, 0, 0, 0, 1];
// plate: back face (y = t) down. (x,y,z) -> (x, z, -y)
const PLATE_UP: Rot = [1, 0, 0, 0, 0, 1, 0, -1, 0];
// vclamp: plate face (y = y0) down, V groove up. (x,y,z) -> (x, -z, y)
const VCLAMP_UP: Rot = [1, 0, 0, 0, 0, -1, 0, 1, 0];

export function printRotation(id: PartId): Rot {
  return id === 'plate' ? PLATE_UP : id === 'vclamp' ? VCLAMP_UP : IDENTITY;
}

/** Bounding box of `bbox` after rotation r. */
function rotatedBBox(r: Rot, bbox: BBox): BBox {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const x of [bbox.min[0], bbox.max[0]])
    for (const y of [bbox.min[1], bbox.max[1]])
      for (const z of [bbox.min[2], bbox.max[2]])
        for (let i = 0; i < 3; i++) {
          const v = r[i * 3]! * x + r[i * 3 + 1]! * y + r[i * 3 + 2]! * z;
          min[i] = Math.min(min[i]!, v);
          max[i] = Math.max(max[i]!, v);
        }
  return { min, max };
}

/**
 * Column-major Mat4 taking a builder-frame solid (with the given bbox) to print
 * orientation: rotate per part, centre in XY on the bed origin, min z = 0.
 */
export function printMatrix(id: PartId, bbox: BBox): Mat4 {
  const r = printRotation(id);
  const b = rotatedBBox(r, bbox);
  const tx = -(b.min[0] + b.max[0]) / 2;
  const ty = -(b.min[1] + b.max[1]) / 2;
  const tz = -b.min[2];
  return [
    r[0], r[3], r[6], 0,
    r[1], r[4], r[7], 0,
    r[2], r[5], r[8], 0,
    tx, ty, tz, 1,
  ];
}

/** Applies printMatrix to a solid owned by `s`. */
export function toPrintOrientation(s: Scope, id: PartId, m: Manifold): Manifold {
  const bb = m.boundingBox();
  return s.transform(m, printMatrix(id, { min: bb.min, max: bb.max }));
}
