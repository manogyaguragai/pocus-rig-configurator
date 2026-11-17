import type { Manifold, MeshData, Scope } from './manifold';
import type { Params } from './params';

export type PartId =
  | 'holster'
  | 'caddy'
  | 'gloveTube'
  | 'gloveBox'
  | 'plate'
  | 'vclamp'
  | 'calibMale'
  | 'calibFemaleLo'
  | 'calibFemale'
  | 'calibFemaleHi';

export const RIG_PARTS: readonly PartId[] = ['holster', 'caddy', 'gloveTube', 'gloveBox', 'plate', 'vclamp'];
export const CALIB_PARTS: readonly PartId[] = ['calibMale', 'calibFemaleLo', 'calibFemale', 'calibFemaleHi'];

/**
 * Every part builder has this shape. It receives CLAMPED params and a Scope, and returns
 * a solid in the BLENDER frame exactly as pocus_rig.py (module-local, before the +35 z
 * lift, before any exploded/print transform). It must create all temporaries through the
 * scope and never call .delete(). The driver releases the returned Manifold.
 */
export type PartBuilder = (s: Scope, params: Params) => Manifold;

export type PartMeta = {
  id: PartId;
  /** reference object name in pocus_rig.py / report.json (null: no reference object) */
  refName: string | null;
  /** used in export filenames: POCUS_<fileName>_tol0p25.stl */
  fileName: string;
  label: string;
  material: 'teal' | 'slate';
};

export type BBox = { min: [number, number, number]; max: [number, number, number] };

export type PartResult = {
  id: PartId;
  /** Blender frame, unlifted, no exploded offset */
  mesh: MeshData;
  /** print orientation: rotated, centred in XY, min z = 0 */
  printMesh: MeshData;
  /** mm^3 */
  volume: number;
  bbox: BBox;
  printBBox: BBox;
  numTri: number;
  /** Manifold status string; 'NoError' when valid */
  status: string;
};

/** Which Params keys change each part (SPEC 5: dependency-scoped rebuilds). */
export const PART_DEPS: Readonly<Record<PartId, readonly (keyof Params)[]>> = {
  holster: ['tolerance', 'probePreset', 'cradleW', 'cradleD', 'holsterH'],
  caddy: ['tolerance', 'probePreset', 'cradleW', 'cradleD', 'gelH', 'gelW'],
  gloveTube: ['tolerance', 'probePreset', 'cradleW', 'cradleD', 'tubeD', 'tubeH'],
  gloveBox: ['tolerance', 'probePreset', 'cradleW', 'cradleD', 'gloveBoxW', 'gloveBoxH'],
  plate: ['mount', 'plateW', 'plateH'],
  vclamp: ['mount'],
  calibMale: [],
  calibFemaleLo: ['tolerance'],
  calibFemale: ['tolerance'],
  calibFemaleHi: ['tolerance'],
};

export const PART_META: Readonly<Record<PartId, PartMeta>> = {
  holster: { id: 'holster', refName: 'POCUS_Holster', fileName: 'Holster', label: 'Probe holster', material: 'teal' },
  caddy: { id: 'caddy', refName: 'Gel_Packet_Caddy', fileName: 'GelCaddy', label: 'Gel packet caddy', material: 'teal' },
  gloveTube: { id: 'gloveTube', refName: 'Glove_Side_Module', fileName: 'GloveTube', label: 'Glove tube', material: 'teal' },
  gloveBox: { id: 'gloveBox', refName: 'Glove_Side_Module_BoxBracket', fileName: 'GloveBox', label: 'Glove box bracket', material: 'teal' },
  plate: { id: 'plate', refName: 'Universal_Mount_Plate', fileName: 'WallPlate', label: 'Wall plate', material: 'slate' },
  vclamp: { id: 'vclamp', refName: 'Mount_IV_Pole_VClamp', fileName: 'VClamp', label: 'IV pole V-clamp', material: 'slate' },
  calibMale: { id: 'calibMale', refName: 'Calib_Male', fileName: 'CalibMale', label: 'Calibration rail', material: 'slate' },
  calibFemaleLo: { id: 'calibFemaleLo', refName: null, fileName: 'CalibSlotLo', label: 'Calibration slot, tight', material: 'teal' },
  calibFemale: { id: 'calibFemale', refName: 'Calib_Female', fileName: 'CalibSlot', label: 'Calibration slot', material: 'teal' },
  calibFemaleHi: { id: 'calibFemaleHi', refName: null, fileName: 'CalibSlotHi', label: 'Calibration slot, loose', material: 'teal' },
};

/** Parts that exist for a given configuration (SPEC 4c); calibration parts are separate (CALIB_PARTS). */
export function activeParts(p: Params): PartId[] {
  const out: PartId[] = ['plate', 'holster', 'caddy', p.gloveMode === 'tube' ? 'gloveTube' : 'gloveBox'];
  if (p.mount === 'ivpole') out.push('vclamp');
  return out;
}
