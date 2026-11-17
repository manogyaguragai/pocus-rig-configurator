import {
  BLOCK_HALF, BLOCK_T, CALIB_BEVEL, CALIB_BEVEL_SEGS, CALIB_H, CALIB_MALE_D, CALIB_MALE_HALF_W, CALIB_NOTCH_D,
  CALIB_NOTCH_PITCH, CALIB_NOTCH_W, CALIB_TOL_MIN, CALIB_TOL_STEP, CUT_OVERSHOOT, RAIL_EMBED,
} from '../constants';
import { RailFrame, femaleProfile, maleProfile } from '../dovetail';
import type { Manifold, Scope } from '../manifold';
import type { Params } from '../params';
import type { PartBuilder } from '../types';

const FR = new RailFrame([0, 0], [0, -1], [1, 0]);

/** Tolerance used for a calibration female: tol + delta, never below CALIB_TOL_MIN. */
export const calibTol = (tol: number, delta: number): number => Math.max(CALIB_TOL_MIN, tol + delta);

/** Male rail block, assembled pose (x = 0, no scene offset). */
export const buildCalibMale: PartBuilder = (s) => {
  const male = s.box(-CALIB_MALE_HALF_W, CALIB_MALE_HALF_W, 0, CALIB_MALE_D, 0, CALIB_H, CALIB_BEVEL, CALIB_BEVEL_SEGS);
  return s.union(male, s.prismZ(maleProfile().map(([a, t]) => FR.xy(a, t)), 0, CALIB_H));
};

function female(s: Scope, tol: number, notches: number): Manifold {
  const back = -(BLOCK_T - RAIL_EMBED); // ref: y from -BLOCK_T + 0.6 to -tol
  const fem = s.box(-BLOCK_HALF, BLOCK_HALF, back, -tol, 0, CALIB_H, CALIB_BEVEL, CALIB_BEVEL_SEGS);
  const slot = s.prismZ(femaleProfile(tol).map(([a, t]) => FR.xy(a, t)), -CUT_OVERSHOOT, CALIB_H + CUT_OVERSHOOT);
  // vertical grooves on the back face tell the three pieces apart (1 / 2 / 3)
  const grooves: Manifold[] = [];
  for (let i = 0; i < notches; i++) {
    const x = (i - (notches - 1) / 2) * CALIB_NOTCH_PITCH;
    grooves.push(s.box(x - CALIB_NOTCH_W / 2, x + CALIB_NOTCH_W / 2, back - CUT_OVERSHOOT, back + CALIB_NOTCH_D, -CUT_OVERSHOOT, CALIB_H + CUT_OVERSHOOT));
  }
  return s.cut(fem, slot, ...grooves);
}

const make = (delta: number, notches: number): PartBuilder => (s: Scope, p: Params) =>
  female(s, calibTol(p.tolerance, delta), notches);

export const buildCalibFemaleLo: PartBuilder = make(-CALIB_TOL_STEP, 1);
export const buildCalibFemale: PartBuilder = make(0, 2);
export const buildCalibFemaleHi: PartBuilder = make(CALIB_TOL_STEP, 3);
