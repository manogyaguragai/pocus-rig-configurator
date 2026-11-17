import {
  AMPS_HALF_X, AMPS_HALF_Z, CBORE_DEPTH, CUT_OVERSHOOT, KEY_SEGS, CBORE_R, HOLE_CENTRE_Z, HOLE_SEGS, KEY_HEAD_R, KEY_POCKET_DEPTH,
  KEY_SLOT_HALF, KEY_SLOT_LEN, KEY_Z_HIGH, KEY_Z_LOW, M4_R, MAGNET_DEPTH, MAGNET_R, MAGNET_SEGS, MAGNET_X,
  MAGNET_Z_INSET, PLATE_BEVEL, PLATE_T, PLATE_Z0, VESA100_HALF, VESA75_HALF,
} from '../constants';
import { addMaleRail } from '../dovetail';
import { layout } from '../layout';
import { DEFAULT_PARAMS } from '../params';
import type { Manifold, Scope, Vec2 } from '../manifold';
import type { Params } from '../params';
import type { PartBuilder } from '../types';

const Z0 = PLATE_Z0;
/** Plate top: the bottom is fixed at Z0, so extra height goes on top. */
const top = (p: Params) => Z0 + p.plateH;

/** Four holes at +-hx, HOLE_CENTRE_Z +- hz. */
const pattern = (hx: number, hz: number): Vec2[] =>
  [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec2 => [sx * hx, HOLE_CENTRE_Z + sz * hz]));
const vesa75 = (): Vec2[] => pattern(VESA75_HALF, VESA75_HALF);
const vesa100 = (): Vec2[] => pattern(VESA100_HALF, VESA100_HALF);
const amps = (): Vec2[] => pattern(AMPS_HALF_X, AMPS_HALF_Z);

function base(s: Scope, p: Params): Manifold {
  const body = s.box(-p.plateW / 2, p.plateW / 2, 0, PLATE_T, Z0, top(p), PLATE_BEVEL);
  return addMaleRail(s, body, layout(DEFAULT_PARAMS).frPlate); // plate rail frame is parameter independent
}

function holeCutters(s: Scope, pts: Vec2[]): Manifold[] {
  return pts.flatMap((c) => [
    s.cylY(M4_R, c, -CUT_OVERSHOOT, PLATE_T + CUT_OVERSHOOT, HOLE_SEGS),
    s.cylY(CBORE_R, c, -CUT_OVERSHOOT, CBORE_DEPTH, HOLE_SEGS),
  ]);
}

function keyholeCutters(s: Scope, p: Params): Manifold[] {
  return [Z0 + KEY_Z_LOW, top(p) - KEY_Z_HIGH].flatMap((zc) => [
    s.cylY(KEY_HEAD_R, [0, zc], -CUT_OVERSHOOT, PLATE_T + CUT_OVERSHOOT, KEY_SEGS),
    s.box(-KEY_SLOT_HALF, KEY_SLOT_HALF, -CUT_OVERSHOOT, PLATE_T + CUT_OVERSHOOT, zc, zc + KEY_SLOT_LEN),
    s.box(-KEY_HEAD_R, KEY_HEAD_R, PLATE_T - KEY_POCKET_DEPTH, PLATE_T + CUT_OVERSHOOT, zc, zc + KEY_SLOT_LEN),
  ]);
}

function magnetCutters(s: Scope, p: Params): Manifold[] {
  return [-MAGNET_X, MAGNET_X].flatMap((x) =>
    [Z0 + MAGNET_Z_INSET, top(p) - MAGNET_Z_INSET].map((zc) =>
      s.cylY(MAGNET_R, [x, zc], PLATE_T - MAGNET_DEPTH, PLATE_T + CUT_OVERSHOOT, MAGNET_SEGS)));
}

/** Plate for the chosen mount only (SPEC 4c), sized plateW x plateH. */
export const buildPlate: PartBuilder = (s, params) => {
  const body = base(s, params);
  switch (params.mount) {
    case 'vesa':
      return s.cut(body, ...holeCutters(s, [...vesa75(), ...vesa100()]), ...keyholeCutters(s, params));
    case 'amps':
    case 'ivpole':
      return s.cut(body, ...holeCutters(s, amps()));
    case 'magnets':
      return s.cut(body, ...magnetCutters(s, params));
    default:
      return body; // tape: flat back, no holes
  }
};

/** Exactly the Python make_plate: every pattern at once. Used only for the volume acceptance test. */
export function makePlateReference(s: Scope): Manifold {
  return s.cut(
    base(s, DEFAULT_PARAMS),
    ...holeCutters(s, [...vesa75(), ...vesa100(), ...amps()]),
    ...keyholeCutters(s, DEFAULT_PARAMS),
    ...magnetCutters(s, DEFAULT_PARAMS),
  );
}
