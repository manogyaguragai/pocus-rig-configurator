import {
  CADDY_BEVEL, CADDY_BEVEL_SEGS, DISP_INSET_X, DISP_Z1, FRONT_CUT_Y_IN, FRONT_CUT_Y_OUT, GEL_D,
  MODULE_BACK_Y, MODULE_WALL, THUMB_R, THUMB_Z, VIEW_BEVEL, VIEW_HALF_X, VIEW_Z0, VIEW_Z1_BELOW_TOP,
} from '../constants';
import { addFemaleBlock } from '../dovetail';
import { layout } from '../layout';
import type { PartBuilder } from '../types';

/** Port of make_gel_caddy. Height = gelH + wall, inner width = gelW; x follows the holster width; back aligned at y = -8. */
export const buildCaddy: PartBuilder = (s, params) => {
  const L = layout(params);
  const wl = MODULE_WALL;
  const h = params.gelH;
  const x0 = L.moduleInnerX;
  const x1 = x0 + params.gelW + 2 * wl;
  const y1 = MODULE_BACK_Y;
  const y0 = y1 - (GEL_D + 2 * wl);
  const cx = (x0 + x1) / 2;
  const fy0 = y0 - FRONT_CUT_Y_OUT;
  const fy1 = y0 + FRONT_CUT_Y_IN;
  let ob = s.box(x0, x1, y0, y1, 0, h + wl, CADDY_BEVEL, CADDY_BEVEL_SEGS);
  ob = s.cut(
    ob,
    s.box(x0 + wl, x1 - wl, y0 + wl, y1 - wl, wl, h + 10),
    s.box(cx - VIEW_HALF_X, cx + VIEW_HALF_X, fy0, fy1, VIEW_Z0, h - VIEW_Z1_BELOW_TOP, VIEW_BEVEL),
    s.box(x0 + DISP_INSET_X, x1 - DISP_INSET_X, fy0, fy1, wl, DISP_Z1),
    s.cylY(THUMB_R, [cx, THUMB_Z], fy0, fy1),
  );
  return addFemaleBlock(s, ob, L.frRight, params.tolerance);
};
