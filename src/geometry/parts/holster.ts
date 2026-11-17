import { addFemaleBlock, addMaleRail } from '../dovetail';
import {
  CAVITY_TOP_Z_EXTRA, DRAIN_BEVEL, DRAIN_HALF_X, DRAIN_Y_BACK_REL, DRAIN_Y_FRONT_EXTRA, DRAIN_Z0, DRAIN_Z1,
  HOLSTER_BACK_Y, HOLSTER_BEVEL, HOLSTER_FLOOR, REF_CAV_BOT_HALF_W, RIB_FLOOR_MARGIN, RIB_HALF_X, RIB_HALF_Y, RIB_X,
  RIB_Z0_REL, RIB_Z1_REL, STRAP_BACK_Y_END, STRAP_EDGE_MARGIN_X, STRAP_FRONT_Y_EXTRA,
  STRAP_FRONT_Y_REL, STRAP_HALF_X, STRAP_IN_MIN, STRAP_MID_Z, STRAP_WALL_CLEAR, STRAP_Z0, STRAP_Z1, WINDOW_BEVEL,
  WINDOW_EDGE_MARGIN_X, WINDOW_EDGE_MARGIN_Y, WINDOW_HALF_X, WINDOW_Y_BACK_REL, WINDOW_Y_FRONT_EXTRA,
  WINDOW_Z0_FRAC, WINDOW_Z1_FRAC,
} from '../constants';
import { layout } from '../layout';
import type { PartBuilder } from '../types';

export const buildHolster: PartBuilder = (s, params) => {
  const L = layout(params);
  const h = L.holsterH;
  const w = L.holsterW;
  const d = L.holsterD;
  const hc = L.hcY;
  const yFront = HOLSTER_BACK_Y - d;
  const tol = params.tolerance;
  const floor = HOLSTER_FLOOR;

  // Outer body = cavity + 8 (bevel on the shell only, before cuts, as in the ref).
  let body = s.box(-w / 2, w / 2, yFront, HOLSTER_BACK_Y, 0, h, HOLSTER_BEVEL);

  // Tapered probe cradle, open top (ref frustum to h + 5).
  const cavTopZ = h + CAVITY_TOP_Z_EXTRA;
  body = s.cut(body, s.frustum(0, hc, floor, cavTopZ, L.cavBotW, L.cavBotD, L.cavTopW, L.cavTopD));
  // cavity width/depth at height z (linear frustum), used to keep cuts valid when the cradle shrinks
  const halfAt = (z: number, b: number, t: number) => (b + ((t - b) * (z - floor)) / (cavTopZ - floor)) / 2;

  // Acoustic-lens bumper ribs. x positions scale with the cavity floor width (ref values at default);
  // length clamped so the ribs never reach the cavity floor edge at 30x20. (DEVIATION, see ARCH.md)
  const ribScale = L.cavBotW / 2 / REF_CAV_BOT_HALF_W;
  const ribHalfL = Math.min(RIB_HALF_Y, L.cavBotD / 2 - RIB_FLOOR_MARGIN);
  const ribs = RIB_X.map((x) => {
    const cx = x * ribScale;
    return s.box(cx - RIB_HALF_X, cx + RIB_HALF_X, hc - ribHalfL, hc + ribHalfL, floor + RIB_Z0_REL, floor + RIB_Z1_REL);
  });
  body = s.union(body, ...ribs);

  // Bottom DRAIN slot (SPEC 4d.2: formerly "cord relief / charging pass-through"; geometry unchanged).
  body = s.cut(body, s.box(-DRAIN_HALF_X, DRAIN_HALF_X, yFront - DRAIN_Y_FRONT_EXTRA, hc + DRAIN_Y_BACK_REL, DRAIN_Z0, DRAIN_Z1, DRAIN_BEVEL));

  // Front viewing / grab window, z = 0.38h -> 0.80h. Clamped at small cradles so it still breaches the front wall.
  const winHalfW = Math.min(WINDOW_HALF_X, L.cradleW / 2 - WINDOW_EDGE_MARGIN_X);
  const winInner = Math.min(WINDOW_Y_BACK_REL, L.cavBotD / 2 - WINDOW_EDGE_MARGIN_Y);
  body = s.cut(body, s.box(-winHalfW, winHalfW, yFront - WINDOW_Y_FRONT_EXTRA, hc - winInner, WINDOW_Z0_FRAC * h, WINDOW_Z1_FRAC * h, WINDOW_BEVEL));

  // Retention strap slots, FIXED z 88..92. Width follows the cradle; the inner end is 4 mm past the cavity wall
  // at the slot mid height (ref: 12 mm from centre at default, kept via the min()).
  const strapHalfW = Math.min(STRAP_HALF_X, L.cradleW / 2 - STRAP_EDGE_MARGIN_X);
  const strapIn = Math.min(-STRAP_FRONT_Y_REL, Math.max(STRAP_IN_MIN, halfAt(STRAP_MID_Z, L.cavBotD, L.cavTopD) - STRAP_WALL_CLEAR));
  body = s.cut(
    body,
    s.box(-strapHalfW, strapHalfW, yFront - STRAP_FRONT_Y_EXTRA, hc - strapIn, STRAP_Z0, STRAP_Z1),
    s.box(-strapHalfW, strapHalfW, hc + strapIn, STRAP_BACK_Y_END, STRAP_Z0, STRAP_Z1),
  );

  // Dovetails LAST, from the current faces: plate female block, then both side male rails.
  body = addFemaleBlock(s, body, L.frPlate, tol);
  body = addMaleRail(s, body, L.frRight);
  body = addMaleRail(s, body, L.frLeft);
  return body;
};
