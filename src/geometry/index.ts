import { loadManifold, Scope, withScope, type Manifold, type ManifoldApi } from './manifold';
import { clampParams, type Params } from './params';
import { printMatrix } from './placement';
import { buildCaddy } from './parts/caddy';
import { buildCalibFemale, buildCalibFemaleHi, buildCalibFemaleLo, buildCalibMale } from './parts/calibration';
import { buildGloveBox } from './parts/gloveBox';
import { buildGloveTube } from './parts/gloveTube';
import { buildHolster } from './parts/holster';
import { buildPlate } from './parts/plate';
import { buildVClamp } from './parts/vclamp';
import { activeParts, type BBox, type PartBuilder, type PartId, type PartResult } from './types';

export * from './constants';
export * from './params';
export * from './types';
export * from './placement';
export * from './layout';
export * from './dovetail';
export * from './manifold';

const RAW_BUILDERS: Readonly<Record<PartId, PartBuilder>> = {
  holster: buildHolster,
  caddy: buildCaddy,
  gloveTube: buildGloveTube,
  gloveBox: buildGloveBox,
  plate: buildPlate,
  vclamp: buildVClamp,
  calibMale: buildCalibMale,
  calibFemaleLo: buildCalibFemaleLo,
  calibFemale: buildCalibFemale,
  calibFemaleHi: buildCalibFemaleHi,
};

/** Every entry clamps its params (SPEC 4a) before building, so the builder path cannot be bypassed. */
export const BUILDERS: Readonly<Record<PartId, PartBuilder>> = Object.fromEntries(
  (Object.entries(RAW_BUILDERS) as [PartId, PartBuilder][]).map(([id, b]): [PartId, PartBuilder] => [
    id,
    (s, p) => b(s, clampParams(p)),
  ]),
) as Record<PartId, PartBuilder>;

/**
 * Builds one part inside the caller's Scope (Blender frame, unlifted). The result is owned
 * by `s` and freed with it. Clamps params first. Intended for tests and composite checks.
 */
export function buildPartIn(s: Scope, id: PartId, params: Partial<Params>): Manifold {
  return BUILDERS[id](s, clampParams(params));
}

function bbox(m: Manifold): BBox {
  const b = m.boundingBox();
  return { min: [...b.min], max: [...b.max] };
}

/** Builds one part and returns plain data (no WASM objects escape). */
export async function buildPart(id: PartId, params: Partial<Params>, api?: ManifoldApi): Promise<PartResult> {
  const m = api ?? (await loadManifold());
  const s = new Scope(m);
  try {
    const solid = buildPartIn(s, id, params);
    const bb = bbox(solid);
    const printed = s.transform(solid, printMatrix(id, bb));
    return {
      id,
      mesh: s.meshData(solid),
      printMesh: s.meshData(printed),
      volume: solid.volume(),
      bbox: bb,
      printBBox: bbox(printed),
      numTri: solid.numTri(),
      status: solid.status(),
    };
  } finally {
    s.dispose();
  }
}

/** Builds every active rig part for the configuration (calibration parts excluded). */
export async function buildAll(params: Partial<Params>, api?: ManifoldApi): Promise<PartResult[]> {
  const m = api ?? (await loadManifold());
  const p = clampParams(params);
  return Promise.all(activeParts(p).map((id) => buildPart(id, p, m)));
}

export { withScope };
