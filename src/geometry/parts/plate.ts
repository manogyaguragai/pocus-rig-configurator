import {
  AMPS_HALF_X, AMPS_HALF_Z, CBORE_DEPTH, CUT_OVERSHOOT, KEY_SEGS, CBORE_R, HOLE_CENTRE_Z, HOLE_SEGS, KEY_HEAD_R, KEY_POCKET_DEPTH,
  KEY_SLOT_HALF, KEY_SLOT_LEN, KEY_Z_HIGH, KEY_Z_LOW, M4_R, MAGNET_DEPTH, MAGNET_R, MAGNET_SEGS, MAGNET_X,
  MAGNET_Z_INSET, PLATE_BEVEL, PLATE_H, PLATE_T, PLATE_W, PLATE_Z0, VESA100_HALF, VESA75_HALF,
} from '../constants';
import { addMaleRail } from '../dovetail';
import { layout } from '../layout';
import { DEFAULT_PARAMS } from '../params';
import type { Manifold, Scope, Vec2 } from '../manifold';
import type { PartBuilder } from '../types';

const Z0 = PLATE_Z0;
const Z1 = PLATE_Z0 + PLATE_H;

/** Four holes at +-hx, HOLE_CENTRE_Z +- hz. */
const pattern = (hx: number, hz: number): Vec2[] =>
  [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec2 => [sx * hx, HOLE_CENTRE_Z + sz * hz]));
const vesa75 = (): Vec2[] => pattern(VESA75_HALF, VESA75_HALF);
const vesa100 = (): Vec2[] => pattern(VESA100_HALF, VESA100_HALF);
const amps = (): Vec2[] => pattern(AMPS_HALF_X, AMPS_HALF_Z);

function base(s: Scope): Manifold {
  const body = s.box(-PLATE_W / 2, PLATE_W / 2, 0, PLATE_T, Z0, Z1, PLATE_BEVEL);
  return addMaleRail(s, body, layout(DEFAULT_PARAMS).frPlate); // plate rail frame is parameter independent
}

function holeCutters(s: Scope, pts: Vec2[]): Manifold[] {
  return pts.flatMap((c) => [
    s.cylY(M4_R, c, -CUT_OVERSHOOT, PLATE_T + CUT_OVERSHOOT, HOLE_SEGS),
    s.cylY(CBORE_R, c, -CUT_OVERSHOOT, CBORE_DEPTH, HOLE_SEGS),
  ]);
}

function keyholeCutters(s: Scope): Manifold[] {
  return [Z0 + KEY_Z_LOW, Z1 - KEY_Z_HIGH].flatMap((zc) => [
    s.cylY(KEY_HEAD_R, [0, zc], -CUT_OVERSHOOT, PLATE_T + CUT_OVERSHOOT, KEY_SEGS),
    s.box(-KEY_SLOT_HALF, KEY_SLOT_HALF, -CUT_OVERSHOOT, PLATE_T + CUT_OVERSHOOT, zc, zc + KEY_SLOT_LEN),
    s.box(-KEY_HEAD_R, KEY_HEAD_R, PLATE_T - KEY_POCKET_DEPTH, PLATE_T + CUT_OVERSHOOT, zc, zc + KEY_SLOT_LEN),
  ]);
}

function magnetCutters(s: Scope): Manifold[] {
  return [-MAGNET_X, MAGNET_X].flatMap((x) =>
    [Z0 + MAGNET_Z_INSET, Z1 - MAGNET_Z_INSET].map((zc) =>
      s.cylY(MAGNET_R, [x, zc], PLATE_T - MAGNET_DEPTH, PLATE_T + CUT_OVERSHOOT, MAGNET_SEGS)));
}

/** Plate for the chosen mount only (SPEC 4c). */
export const buildPlate: PartBuilder = (s, params) => {
  const body = base(s);
  switch (params.mount) {
    case 'vesa':
      return s.cut(body, ...holeCutters(s, [...vesa75(), ...vesa100()]), ...keyholeCutters(s));
    case 'amps':
    case 'ivpole':
      return s.cut(body, ...holeCutters(s, amps()));
    case 'magnets':
      return s.cut(body, ...magnetCutters(s));
    default:
      return body; // tape: flat back, no holes
  }
};

/** Exactly the Python make_plate: every pattern at once. Used only for the volume acceptance test. */
export function makePlateReference(s: Scope): Manifold {
  return s.cut(
    base(s),
    ...holeCutters(s, [...vesa75(), ...vesa100(), ...amps()]),
    ...keyholeCutters(s),
    ...magnetCutters(s),
  );
}
