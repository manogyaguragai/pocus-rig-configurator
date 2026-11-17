import {
  AMPS_HALF_X, AMPS_HALF_Z, CUT_OVERSHOOT, HOLE_CENTRE_Z, HOLE_SEGS, PLATE_T, VCLAMP_BEVEL, VCLAMP_DEPTH, VCLAMP_HALF_W, VCLAMP_HOSE_Z,
  VCLAMP_INSERT_DEPTH, VCLAMP_INSERT_R, VCLAMP_TUNNEL_H, VCLAMP_TUNNEL_HALF_X, VCLAMP_TUNNEL_Y0, VCLAMP_V_DEPTH,
  VCLAMP_V_HALF, VCLAMP_V_Z0, VCLAMP_V_Z1, VCLAMP_Z0, VCLAMP_Z1, VCLAMP_ZIP_H, VCLAMP_ZIP_Z,
} from '../constants';
import type { PartBuilder } from '../types';

/** y of the V apex and tunnel ceiling (absolute, builder frame). */
export const VCLAMP_Y0 = PLATE_T;
export const VCLAMP_Y1 = PLATE_T + VCLAMP_DEPTH;
export const VCLAMP_APEX_Y = VCLAMP_Y1 - VCLAMP_V_DEPTH;
export const VCLAMP_TUNNEL_CEIL_Y = VCLAMP_Y0 + VCLAMP_TUNNEL_Y0 + VCLAMP_TUNNEL_H;

export const buildVClamp: PartBuilder = (s) => {
  const y0 = VCLAMP_Y0, y1 = VCLAMP_Y1;
  const body = s.box(-VCLAMP_HALF_W, VCLAMP_HALF_W, y0, y1, VCLAMP_Z0, VCLAMP_Z1, VCLAMP_BEVEL);
  // 90 degree V: half-width 13 at y1+1 down to the apex 13 below y1 (45 degree flanks)
  const v = s.prismZ(
    [[-VCLAMP_V_HALF, y1 + CUT_OVERSHOOT], [VCLAMP_V_HALF, y1 + CUT_OVERSHOOT], [0, VCLAMP_APEX_Y]], VCLAMP_V_Z0, VCLAMP_V_Z1);
  const cutters = [v];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      cutters.push(s.cylY(VCLAMP_INSERT_R, [sx * AMPS_HALF_X, HOLE_CENTRE_Z + sz * AMPS_HALF_Z], y0 - CUT_OVERSHOOT, y0 + VCLAMP_INSERT_DEPTH, HOLE_SEGS));
  const ty0 = y0 + VCLAMP_TUNNEL_Y0, ty1 = ty0 + VCLAMP_TUNNEL_H;
  const X = VCLAMP_TUNNEL_HALF_X;
  cutters.push(s.box(-X, X, ty0, ty1, VCLAMP_HOSE_Z[0], VCLAMP_HOSE_Z[1]));
  for (const zc of VCLAMP_ZIP_Z) cutters.push(s.box(-X, X, ty0, ty1, zc, zc + VCLAMP_ZIP_H));
  return s.cut(body, ...cutters);
};
