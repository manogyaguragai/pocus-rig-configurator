import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, RAIL_BASE, RAIL_H, RAIL_TIP, Scope, buildPartIn, loadManifold, type ManifoldApi, type PartId } from '../index';
import { calibTol } from '../parts/calibration';

let api: ManifoldApi;
beforeAll(async () => { api = await loadManifold(); });
const FEMALES: PartId[] = ['calibFemaleLo', 'calibFemale', 'calibFemaleHi'];

describe('calibration', () => {
  it('male-female intersection is 0 and all manifold, 10 mm tall', () => {
    const s = new Scope(api);
    try {
      const male = buildPartIn(s, 'calibMale', DEFAULT_PARAMS);
      expect(male.status()).toBe('NoError');
      expect(male.boundingBox().max[2]).toBeCloseTo(10, 6);
      for (const id of FEMALES) {
        const f = buildPartIn(s, id, DEFAULT_PARAMS);
        expect(f.status()).toBe('NoError');
        expect(f.genus()).toBeGreaterThanOrEqual(0);
        expect(s.intersect(male, f).volume()).toBe(0);
        process.stderr.write(`\n${id}: vol ${(f.volume() / 1000).toFixed(3)} cm3 (ref 1.23)`);
      }
    } finally { s.dispose(); }
  });

  // Slot opening measured in a thin probe row inside the block (t = 2.0..2.5 from the face, z 4..6, x +-10):
  // open width = 20 - solid volume / (0.5 * 2). Block spans x +-12.5 so the row is fully inside it.
  const PROBE_T0 = 2.0, PROBE_T1 = 2.5, PROBE_DZ = 2;
  const slotWidth = (s: Scope, id: PartId, tol: number) => {
    const f = buildPartIn(s, id, { ...DEFAULT_PARAMS, tolerance: tol });
    const row = s.box(-10, 10, -PROBE_T1, -PROBE_T0, 4, 4 + PROBE_DZ);
    return 20 - s.intersect(f, row).volume() / ((PROBE_T1 - PROBE_T0) * PROBE_DZ);
  };
  /** Analytic opening at mid-probe: 2 * (base/2 + slope * t + tol * sqrt(1 + slope^2)). */
  const analyticWidth = (tol: number) => {
    const b = RAIL_BASE / 2, slope = (RAIL_TIP / 2 - b) / RAIL_H;
    return 2 * (b + slope * ((PROBE_T0 + PROBE_T1) / 2) + tol * Math.sqrt(1 + slope ** 2));
  };

  it('slot width increases monotonically with tolerance and matches the analytic profile', () => {
    const s = new Scope(api);
    try {
      const tols = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4];
      const w = tols.map((t) => slotWidth(s, 'calibFemale', t));
      for (let i = 1; i < w.length; i++) expect(w[i]!).toBeGreaterThan(w[i - 1]!);
      tols.forEach((t, i) => expect(w[i]!).toBeCloseTo(analyticWidth(t), 3));
    } finally { s.dispose(); }
  });

  it('Lo / mid / Hi pieces at default tol have increasing slot width and decreasing material', () => {
    const s = new Scope(api);
    try {
      const w = FEMALES.map((id) => slotWidth(s, id, DEFAULT_PARAMS.tolerance));
      expect(w[0]!).toBeLessThan(w[1]!);
      expect(w[1]!).toBeLessThan(w[2]!);
      // tol -/+ 0.05 per piece
      expect(w[1]! - w[0]!).toBeCloseTo(analyticWidth(0.25) - analyticWidth(0.2), 3);
      const v = FEMALES.map((id) => buildPartIn(s, id, DEFAULT_PARAMS).volume());
      expect(v[0]!).toBeGreaterThan(v[1]!); // tighter slot AND fewer notches: more material
      expect(v[1]!).toBeGreaterThan(v[2]!);
    } finally { s.dispose(); }
  });

  it('clamps tol-0.05 to >= 0.05', () => {
    expect(calibTol(0.15, -0.05)).toBeCloseTo(0.1);
    expect(calibTol(0.02, -0.05)).toBe(0.05);
  });
});
