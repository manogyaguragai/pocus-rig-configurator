// Single definition of every fixed number. SPEC refs are to ai-notes/SPEC.md;
// "ref" means pocus_rig.py. All lengths in mm, Blender frame (Z up).

export type Range = { readonly min: number; readonly max: number; readonly step: number; readonly default: number };

// ---- SPEC 4a user control ranges -------------------------------------------
export const RANGES = {
  tolerance: { min: 0.15, max: 0.4, step: 0.05, default: 0.25 },
  cradleW: { min: 30, max: 80, step: 0.5, default: 62 },
  cradleD: { min: 20, max: 60, step: 0.5, default: 44 },
  holsterH: { min: 100, max: 160, step: 1, default: 100 },
  gelH: { min: 85, max: 200, step: 1, default: 125 },
} as const satisfies Record<string, Range>;

// ---- SPEC 4b fixed constants ------------------------------------------------
/** Bed reference 256 x 256 x 256 (SPEC 4b). */
export const BED = 256;
/** Hard per-part limit in print orientation (SPEC 4a preamble). */
export const MAX_PART_SIZE = 250;

// Dovetail male profile: base 10, tip 16, height 5, embedded 0.6 (SPEC 4b; ref RAIL_*)
export const RAIL_BASE = 10.0;
export const RAIL_TIP = 16.0;
export const RAIL_H = 5.0;
export const RAIL_EMBED = 0.6;
// Interface span: rail z 10 -> 80, slot block z 0 -> 84 (SPEC 4b; ref RAIL_Z0/Z1, add_female_block z_top)
export const RAIL_Z0 = 10.0;
export const RAIL_Z1 = 80.0;
export const BLOCK_Z_TOP = 84.0;
/** Female slot starts below z=0 so it is open at the bottom (ref prism_z(..., -1.0, ...)). */
export const SLOT_Z_BOTTOM = -1.0;
/** Female profile base sits 1.0 below the parent face line (ref female_profile). */
export const FEMALE_BASE_T = -1.0;
// Slot block: half-width 12.5, thickness 8.6 (incl. 0.6 embed), starts TOL off the parent face (SPEC 4b)
export const BLOCK_HALF = 12.5;
export const BLOCK_T = 8.6;
export const BLOCK_BEVEL = 0.8;
export const BLOCK_BEVEL_SEGS = 2;
// Anti-lift pin hole dia 3.4 at z = 40 (SPEC 4b; ref PIN_R/PIN_Z)
export const PIN_R = 1.7;
export const PIN_Z = 40.0;
/** Pin cylinder extends BLOCK_HALF + this on each side of the rail centre (ref pin_hole span). */
export const PIN_SPAN_EXTRA = 2.0;
export const PIN_SEGS = 32;

// Holster (SPEC 4b: wall 4 at cavity top, outer = cavity top + 8; taper 8; floor 6)
export const HOLSTER_WALL = 4.0;
export const HOLSTER_OUTER_PAD = 2 * HOLSTER_WALL;
export const CRADLE_TAPER = 8.0;
export const HOLSTER_FLOOR = 6.0;
/** Plate-side gap: holster back face sits at y = -8 (ref HC_Y = -8 - d/2). */
export const HOLSTER_BACK_Y = -8.0;
export const HOLSTER_BEVEL = 3.0;
export const HOLSTER_BEVEL_SEGS = 3;
/** ref cuts the cavity frustum 0.2 larger than top_w/top_d and up to h + 5. See ARCH.md "inconsistencies". */
export const CAVITY_TOP_PAD = 0.2;
export const CAVITY_TOP_Z_EXTRA = 5.0;
// Floor ribs (ref make_holster)
export const RIB_X = [-21, -12, 12, 21] as const;
export const RIB_HALF_X = 1.25;
export const RIB_HALF_Y = 16;
export const RIB_Z0_REL = -0.5; // relative to floor
export const RIB_Z1_REL = 3; // relative to floor
// Drain slot (ref "cord"; named "drain" per SPEC 4d.2)
export const DRAIN_HALF_X = 7;
export const DRAIN_Y_FRONT_EXTRA = 1; // beyond front face
export const DRAIN_Y_BACK_REL = 6; // from cavity centre y
export const DRAIN_Z0 = -1;
export const DRAIN_Z1 = 30;
export const DRAIN_BEVEL = 1;
// Front window: z = 0.38h -> 0.80h (SPEC 4c; ref 38..80 at h=100)
export const WINDOW_HALF_X = 15;
export const WINDOW_Y_FRONT_EXTRA = 5;
export const WINDOW_Y_BACK_REL = -11; // from cavity centre y
export const WINDOW_Z0_FRAC = 0.38;
export const WINDOW_Z1_FRAC = 0.8;
export const WINDOW_BEVEL = 3;
// Strap slots stay FIXED at z 88 -> 92 (SPEC 4c)
export const STRAP_HALF_X = 13.5;
export const STRAP_Z0 = 88;
export const STRAP_Z1 = 92;
export const STRAP_FRONT_Y_EXTRA = 2; // beyond front face
export const STRAP_FRONT_Y_REL = -12; // front slot ends at cavity centre y - 12
export const STRAP_BACK_Y_REL = 12; // back slot starts at cavity centre y + 12
export const STRAP_BACK_Y_END = -6; // absolute y where back slot ends (ref)
export const STRAP_MID_Z = (STRAP_Z0 + STRAP_Z1) / 2;
// DEVIATION (ARCH.md): scaling/clamping of ref cuts at non-default cradle sizes
/** Ref cavity floor half-width at defaults ((62 - 8) / 2): rib x positions scale by cavBotW/2 over this. */
export const REF_CAV_BOT_HALF_W = (RANGES.cradleW.default - CRADLE_TAPER) / 2;
export const RIB_FLOOR_MARGIN = 2; // ribs stop this far short of the cavity floor edge in y
export const WINDOW_EDGE_MARGIN_X = 2; // window half-width <= cradleW/2 - this
export const WINDOW_EDGE_MARGIN_Y = 3; // window inner reach <= cavBotD/2 - this
export const STRAP_EDGE_MARGIN_X = 3; // strap half-width <= cradleW/2 - this
export const STRAP_WALL_CLEAR = 4; // strap inner end this far past the cavity wall at STRAP_MID_Z
export const STRAP_IN_MIN = 2;
/** Generic boolean-cutter overshoot so cuts break cleanly through faces. */
export const CUT_OVERSHOOT = 1;

// Module walls (caddy, glove parts) 3 mm (SPEC 4b)
export const MODULE_WALL = 3.0;
// Gel packet inner clearance 55 x 35 (SPEC 4b)
export const GEL_W = 55.0;
export const GEL_D = 35.0;
/** caddy height = packet + wall (SPEC 4c) */
export const CADDY_BEVEL = 2;
export const CADDY_BEVEL_SEGS = 3;
/** y of the caddy / glove module back face (aligned with holster body back, ref y1 = -8) */
export const MODULE_BACK_Y = -8.0;
export const VIEW_HALF_X = 7.5;
export const VIEW_Z0 = 35;
export const VIEW_Z1_BELOW_TOP = 13; // view slot top = packet height - 13 (SPEC 4c)
export const VIEW_BEVEL = 2;
export const FRONT_CUT_Y_OUT = 3; // front-face cutters start 3 outside
export const FRONT_CUT_Y_IN = 5; // and reach 5 inside (view, disp, thumb)
export const DISP_INSET_X = 8;
export const DISP_Z1 = 15;
export const THUMB_R = 15;
export const THUMB_Z = 15;

// Glove tube: bore dia 50, wall 3, height 110, front gap 34 (SPEC 4b)
export const TUBE_R_IN = 25.0;
export const TUBE_WALL = 3.0;
export const TUBE_H = 110.0;
export const TUBE_GAP = 34.0;
export const TUBE_SEGS = 96;
export const TUBE_WEB_HALF_Y = 12;
export const TUBE_WEB_X_FROM_CENTRE = 15; // web box starts at cx + 15
export const TUBE_GAP_Z0 = 12;
export const TUBE_GAP_Y_OUT = 8; // gap box starts at cy - ro - 8
export const TUBE_GAP_Y_IN = 16; // and ends at cy - 16
export const TUBE_PUSH_R = 10;
export const TUBE_PLATE_CLEAR = 1; // tube centre clamp: back edge stays <= this short of the plate plane y = 0
export const TUBE_WEB_TRIM = 0.2; // web end sits this short of the embedded block face
export const TUBE_CUT_TOP_EXTRA = 5; // bore / gap cutters reach this far above the tube

// Glove box bracket: inner 132 x 87, wall height 73 (SPEC 4b; ref 130+2, 85+2)
export const GLOVEBOX_INNER_W = 132.0;
export const GLOVEBOX_INNER_D = 87.0;
export const GLOVEBOX_WALL_H = 73.0;
export const GLOVEBOX_BEVEL = 2;
export const GLOVEBOX_WIN_INSET_X = 16;
export const GLOVEBOX_WIN_Z0 = 18;
export const GLOVEBOX_WIN_Y_OUT = 3;
export const GLOVEBOX_WIN_Y_IN = 6;
export const GLOVEBOX_WIN_BEVEL = 3;
export const GLOVEBOX_BAND_Z = [55] as const;
export const GLOVEBOX_BAND_H = 4;
export const GLOVEBOX_BAND_INSET_Y = 20;

// Wall plate 124 x 170 x 8; z0 = -35 in the Blender frame (SPEC 4b; ref PLATE)
export const PLATE_W = 124.0;
export const PLATE_H = 170.0;
export const PLATE_T = 8.0;
export const PLATE_Z0 = -35.0;
export const PLATE_BEVEL = 3;
/** Hole-pattern centre z (ref 50). Patterns are 2x on the plate centreline x = 0. */
export const HOLE_CENTRE_Z = 50;
export const VESA75_HALF = 37.5;
export const VESA100_HALF = 50.0;
export const AMPS_HALF_X = 15.0; // 30 mm
export const AMPS_HALF_Z = 19.0; // 38 mm
export const M4_R = 2.25; // dia 4.5
export const CBORE_R = 4.25; // dia 8.5
export const CBORE_DEPTH = 3.0; // front
export const HOLE_SEGS = 32;
// Keyholes: head dia 10.4 / slot 5.2 (SPEC 4b; ref kh/ks/kp)
export const KEY_HEAD_R = 5.2;
export const KEY_SLOT_HALF = 2.6;
export const KEY_SLOT_LEN = 10;
export const KEY_POCKET_DEPTH = 4;
export const KEY_Z_LOW = 15; // from plate bottom
export const KEY_Z_HIGH = 25; // from plate top
export const KEY_SEGS = 48;
// Magnet recess dia 20.4 x 4 (SPEC 4b)
export const MAGNET_R = 10.2;
export const MAGNET_DEPTH = 4;
export const MAGNET_X = 40;
export const MAGNET_Z_INSET = 15; // from plate bottom / top
export const MAGNET_SEGS = 64;

// V-clamp (ref make_vclamp, SPEC 4d.1)
export const VCLAMP_HALF_W = 30;
export const VCLAMP_DEPTH = 25;
export const VCLAMP_Z0 = 15;
export const VCLAMP_Z1 = 85;
export const VCLAMP_BEVEL = 2;
export const VCLAMP_V_HALF = 13; // V mouth half-width at y1 + 1
export const VCLAMP_V_DEPTH = 13; // V tip is y1 - 13
export const VCLAMP_V_Z0 = 14;
export const VCLAMP_V_Z1 = 86;
export const VCLAMP_INSERT_R = 2.8;
export const VCLAMP_INSERT_DEPTH = 6;
/** Ref tunnel y offset from the plate face was 7.5 (ceiling 0.5 under V tip); SPEC 4d.1 moves it 4 toward plate. */
export const VCLAMP_TUNNEL_Y0_REF = 7.5;
export const VCLAMP_TUNNEL_SHIFT = 4.0;
export const VCLAMP_TUNNEL_Y0 = VCLAMP_TUNNEL_Y0_REF - VCLAMP_TUNNEL_SHIFT;
export const VCLAMP_TUNNEL_H = 4.0;
export const VCLAMP_TUNNEL_HALF_X = 31;
export const VCLAMP_HOSE_Z = [44, 56] as const;
export const VCLAMP_ZIP_Z = [21, 74] as const;
export const VCLAMP_ZIP_H = 5;
/** Required minimum wall between any tunnel ceiling and the V groove (SPEC 4d.1). */
export const VCLAMP_MIN_WALL = 4.0;

// Calibration (ref make_calibration; SPEC 7: three female blocks at TOL-0.05 / TOL / TOL+0.05)
export const CALIB_H = 10.0;
export const CALIB_MALE_HALF_W = 15;
export const CALIB_MALE_D = 8;
export const CALIB_BEVEL = 0.6;
export const CALIB_BEVEL_SEGS = 2;
export const CALIB_TOL_STEP = 0.05;
export const CALIB_TOL_MIN = 0.05; // calibration tolerance never drops below this
export const CALIB_NOTCH_W = 1.5;
export const CALIB_NOTCH_D = 1.2;
export const CALIB_NOTCH_PITCH = 4;
