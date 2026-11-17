import {
  GLOVEBOX_BAND_H, GLOVEBOX_BAND_INSET_Y, GLOVEBOX_BAND_TOP_CLEAR, GLOVEBOX_BAND_Z, GLOVEBOX_BEVEL, GLOVEBOX_INNER_D,
  GLOVEBOX_WIN_BEVEL, GLOVEBOX_WIN_INSET_X, GLOVEBOX_WIN_Y_IN, GLOVEBOX_WIN_Y_OUT, GLOVEBOX_WIN_Z0,
  MODULE_BACK_Y, MODULE_WALL,
} from '../constants';
import { addFemaleBlock } from '../dovetail';
import { layout } from '../layout';
import type { PartBuilder } from '../types';

/** Port of make_glove_box (box bracket, back aligned at y = -8, x follows holster width; inner width and wall height from params). */
export const buildGloveBox: PartBuilder = (s, params) => {
  const L = layout(params);
  const wl = MODULE_WALL;
  const x1 = -L.moduleInnerX;
  const x0 = x1 - (params.gloveBoxW + 2 * wl);
  const y1 = MODULE_BACK_Y;
  const y0 = y1 - (GLOVEBOX_INNER_D + 2 * wl);
  const H = params.gloveBoxH;
  let ob = s.box(x0, x1, y0, y1, 0, H, GLOVEBOX_BEVEL);
  const cutters = [
    s.box(x0 + wl, x1 - wl, y0 + wl, y1 - wl, wl, H + 10),
    s.box(x0 + GLOVEBOX_WIN_INSET_X, x1 - GLOVEBOX_WIN_INSET_X, y0 - GLOVEBOX_WIN_Y_OUT, y0 + GLOVEBOX_WIN_Y_IN, GLOVEBOX_WIN_Z0, H + 10, GLOVEBOX_WIN_BEVEL),
  ];
  for (const z of GLOVEBOX_BAND_Z) {
    const zc = Math.min(z, H - GLOVEBOX_BAND_TOP_CLEAR);
    cutters.push(s.box(x0 - 1, x0 + wl + 1, y0 + GLOVEBOX_BAND_INSET_Y, y1 - GLOVEBOX_BAND_INSET_Y, zc, zc + GLOVEBOX_BAND_H));
  }
  ob = s.cut(ob, ...cutters);
  return addFemaleBlock(s, ob, L.frLeft, params.tolerance);
};
