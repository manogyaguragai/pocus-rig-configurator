import { BLOCK_T, CUT_OVERSHOOT, RAIL_EMBED, TUBE_CUT_TOP_EXTRA, TUBE_PLATE_CLEAR, TUBE_WEB_TRIM, TUBE_GAP_FRAC, TUBE_GAP_Y_IN, TUBE_GAP_Y_OUT, TUBE_GAP_Z0, TUBE_PUSH_R, TUBE_SEGS, TUBE_WALL, TUBE_WEB_HALF_Y, TUBE_WEB_X_FROM_CENTRE } from '../constants';
import { addFemaleBlock } from '../dovetail';
import { layout } from '../layout';
import type { PartBuilder } from '../types';

/** Port of make_glove_tube (rolled-glove tube with front C-clip gap; bore diameter and height from params). */
export const buildGloveTube: PartBuilder = (s, params) => {
  const L = layout(params);
  const rIn = params.tubeD / 2;
  const H = params.tubeH;
  const gap = params.tubeD * TUBE_GAP_FRAC;
  const ro = rIn + TUBE_WALL;
  const cx = -L.moduleInnerX - ro;
  const hy = L.hcY; // web + female block stay centred on the holster face
  // DEVIATION FROM REFERENCE: ref uses cy = HC_Y. At small cradleD that pushes the tube past the
  // plate front plane (y = 0), so the tube centre is clamped to keep its back edge at y <= -1.
  // No effect at defaults (hcY = -34).
  const cy = Math.min(hy, -(ro + TUBE_PLATE_CLEAR));
  let ob = s.cylZ(ro, [cx, cy], 0, H, TUBE_SEGS);
  ob = s.union(ob, s.box(cx + TUBE_WEB_X_FROM_CENTRE, -L.holsterW / 2 - BLOCK_T + (RAIL_EMBED - TUBE_WEB_TRIM), hy - TUBE_WEB_HALF_Y, hy + TUBE_WEB_HALF_Y, 0, H));
  ob = s.cut(
    ob,
    s.cylZ(rIn, [cx, cy], TUBE_WALL, H + TUBE_CUT_TOP_EXTRA, TUBE_SEGS),
    s.box(cx - gap / 2, cx + gap / 2, cy - ro - TUBE_GAP_Y_OUT, cy - TUBE_GAP_Y_IN, TUBE_GAP_Z0, H + TUBE_CUT_TOP_EXTRA),
    s.cylZ(TUBE_PUSH_R, [cx, cy], -CUT_OVERSHOOT, TUBE_WALL + CUT_OVERSHOOT),
  );
  return addFemaleBlock(s, ob, L.frLeft, params.tolerance);
};
