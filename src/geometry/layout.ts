import {
  BLOCK_T,
  CRADLE_TAPER,
  CAVITY_TOP_PAD,
  HOLSTER_BACK_Y,
  HOLSTER_OUTER_PAD,
  RAIL_EMBED,
} from './constants';
import { RailFrame } from './dovetail';
import { clampParams, resolveProbe, type Params } from './params';

/**
 * Everything derived from the current Params that more than one part needs (SPEC 4c).
 * Rail frames are computed from the CURRENT holster faces; never cache them.
 */
export type Layout = {
  cradleW: number;
  cradleD: number;
  /** Frustum dims used for the cavity cut (ref PROBE top + CAVITY_TOP_PAD, bottom = top - taper). */
  cavTopW: number;
  cavTopD: number;
  cavBotW: number;
  cavBotD: number;
  holsterW: number;
  holsterD: number;
  holsterH: number;
  /** holster body centre y (ref HC_Y = -8 - d/2) */
  hcY: number;
  /** holster -> wall plate (female block on holster back, rail on plate front) */
  frPlate: RailFrame;
  /** holster +X face -> gel caddy */
  frRight: RailFrame;
  /** holster -X face -> glove module */
  frLeft: RailFrame;
  /** x of the face of a module body that touches a holster side block: w/2 + BLOCK_T - RAIL_EMBED */
  moduleInnerX: number;
};

/** Clamps its input (SPEC 4a), so no caller can derive geometry from out-of-range params. */
export function layout(raw: Partial<Params> | Params): Layout {
  const p = clampParams(raw);
  const { cradleW, cradleD } = resolveProbe(p);
  const holsterW = cradleW + HOLSTER_OUTER_PAD;
  const holsterD = cradleD + HOLSTER_OUTER_PAD;
  const hcY = HOLSTER_BACK_Y - holsterD / 2;
  return {
    cradleW,
    cradleD,
    cavTopW: cradleW + CAVITY_TOP_PAD,
    cavTopD: cradleD + CAVITY_TOP_PAD,
    cavBotW: cradleW - CRADLE_TAPER,
    cavBotD: cradleD - CRADLE_TAPER,
    holsterW,
    holsterD,
    holsterH: p.holsterH,
    hcY,
    frPlate: new RailFrame([0, 0], [0, -1], [1, 0]),
    frRight: new RailFrame([holsterW / 2, hcY], [1, 0], [0, 1]),
    frLeft: new RailFrame([-holsterW / 2, hcY], [-1, 0], [0, -1]),
    moduleInnerX: holsterW / 2 + BLOCK_T - RAIL_EMBED,
  };
}
