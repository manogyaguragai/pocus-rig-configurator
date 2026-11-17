import { beforeAll, describe, expect, it } from 'vitest';
import {
  ASSEMBLY_LIFT_Z, DEFAULT_PARAMS, PROBE_CLEARANCE, PROBE_PRESETS, RANGES, Scope, addFemaleBlock, addMaleRail, clampParams, femaleProfile,
  layout, loadManifold, maleProfile, printMatrix, resolveProbe, toPrintOrientation, withScope,
  type ManifoldApi,
} from '../index';

let api: ManifoldApi;
beforeAll(async () => {
  api = await loadManifold();
});

// Volume of an a x b x c box with all edges rounded to radius r.
function roundedBoxVolume(a: number, b: number, c: number, r: number): number {
  const [ia, ib, ic] = [a - 2 * r, b - 2 * r, c - 2 * r];
  return ia * ib * ic + 2 * r * (ia * ib + ib * ic + ia * ic) + Math.PI * r * r * (ia + ib + ic) + (4 / 3) * Math.PI * r ** 3;
}

describe('manifold helpers', () => {
  it('loads once and caches', async () => {
    expect(await loadManifold()).toBe(api);
  });

  it('male rail and female slot prisms are valid and positive', () => {
    withScope(api, (s) => {
      const fr = layout(DEFAULT_PARAMS).frLeft; // mirrored basis exercises winding normalisation
      const male = s.prismZ(maleProfile().map(([a, t]) => fr.xy(a, t)), 10, 80);
      const slot = s.prismZ(femaleProfile(0.25).map(([a, t]) => fr.xy(a, t)), -1, 80.25);
      for (const m of [male, slot]) {
        expect(m.status()).toBe('NoError');
        expect(m.volume()).toBeGreaterThan(0);
      }
      expect(slot.volume()).toBeGreaterThan(male.volume());
      return s.track(api.Manifold.cube(1)); // any Disposable; released then freed
    });
  });

  it('rail on a face and slot block on another do not intersect and are manifold', () => {
    const s = new Scope(api);
    try {
      const fr = layout(DEFAULT_PARAMS).frPlate;
      const plate = s.box(-62, 62, 0, 8, -35, 135);
      const holster = s.box(-35, 35, -60, -8, 0, 100);
      const p2 = addMaleRail(s, plate, fr);
      const h2 = addFemaleBlock(s, holster, fr, 0.25);
      expect(p2.status()).toBe('NoError');
      expect(h2.status()).toBe('NoError');
      expect(s.intersect(p2, h2).volume()).toBeLessThan(1e-6);
    } finally {
      s.dispose();
    }
  });

  it('cyl axis semantics match the reference', () => {
    withScope(api, (s) => {
      const bb = (m: { boundingBox(): { min: number[]; max: number[] } }) => m.boundingBox();
      const x = bb(s.cylX(2, [5, 7], -10, 10));
      expect(x.min[0]).toBeCloseTo(-10); expect(x.max[0]).toBeCloseTo(10);
      expect((x.min[1]! + x.max[1]!) / 2).toBeCloseTo(5); expect((x.min[2]! + x.max[2]!) / 2).toBeCloseTo(7);
      const y = bb(s.cylY(2, [5, 7], -10, 10));
      expect(y.min[1]).toBeCloseTo(-10); expect((y.min[0]! + y.max[0]!) / 2).toBeCloseTo(5); expect((y.min[2]! + y.max[2]!) / 2).toBeCloseTo(7);
      const z = bb(s.cylZ(2, [5, 7], -10, 10));
      expect(z.max[2]).toBeCloseTo(10); expect((z.min[0]! + z.max[0]!) / 2).toBeCloseTo(5); expect((z.min[1]! + z.max[1]!) / 2).toBeCloseTo(7);
      return s.track(api.Manifold.cube(1));
    });
  });

  it('bevelled box volume is within 1% of the analytic rounded box', () => {
    withScope(api, (s) => {
      for (const [a, b, c, r, segs] of [[70, 52, 100, 3, 3], [68, 41, 128, 2, 3], [25, 8, 10, 0.6, 2]] as const) {
        const m = s.box(0, a, 0, b, 0, c, r, segs);
        expect(m.status()).toBe('NoError');
        const v = roundedBoxVolume(a, b, c, r);
        expect(Math.abs(m.volume() / v - 1)).toBeLessThan(0.01);
      }
      return s.track(api.Manifold.cube(1));
    });
  });

  it('frustum volume matches the prismatoid formula', () => {
    withScope(api, (s) => {
      const f = s.frustum(0, 0, 0, 10, 54, 36, 62, 44);
      const ex = (10 / 6) * (54 * 36 + 62 * 44 + 4 * 58 * 40);
      expect(f.volume()).toBeCloseTo(ex, 3);
      return s.track(api.Manifold.cube(1));
    });
  });
});

describe('placement', () => {
  it('lifts by 35 and prints plate back-down, vclamp plate-face-down', () => {
    expect(ASSEMBLY_LIFT_Z).toBe(35);
    withScope(api, (s) => {
      const plate = s.box(-62, 62, 0, 8, -35, 135);
      const p = toPrintOrientation(s, 'plate', plate).boundingBox();
      expect(p.min[2]).toBeCloseTo(0); expect(p.max[2]).toBeCloseTo(8);
      expect(p.max[1]! - p.min[1]!).toBeCloseTo(170);
      const clamp = s.box(-30, 30, 8, 33, 15, 85);
      const c = toPrintOrientation(s, 'vclamp', clamp).boundingBox();
      expect(c.min[2]).toBeCloseTo(0); expect(c.max[2]).toBeCloseTo(25);
      expect(c.max[1]! - c.min[1]!).toBeCloseTo(70);
      expect(printMatrix('holster', { min: [-40, -60, 0], max: [40, -8, 100] })[14]).toBeCloseTo(0);
      return s.track(api.Manifold.cube(1));
    });
  });
});

describe('params', () => {
  it('defaults are fixed points of clampParams', () => {
    expect(clampParams(DEFAULT_PARAMS)).toEqual(DEFAULT_PARAMS);
  });
  it('clamps and snaps', () => {
    const p = clampParams({ tolerance: 0.9, cradleW: 10, cradleD: 44.3, holsterH: 130.4, gelH: 9999 });
    expect(p.tolerance).toBe(RANGES.tolerance.max);
    expect(p.cradleW).toBe(30);
    expect(p.cradleD).toBe(44.5);
    expect(p.holsterH).toBe(130);
    expect(p.gelH).toBe(200);
    expect(clampParams({ tolerance: 0.17 }).tolerance).toBe(0.15);
  });
  it('validates enums and non-numbers', () => {
    const p = clampParams({ gloveMode: 'x', mount: 'nope', probePreset: 'z', tolerance: NaN } as never);
    expect(p).toEqual(DEFAULT_PARAMS);
  });
  it('presets fill cradle size, custom uses sliders', () => {
    expect(resolveProbe({ ...DEFAULT_PARAMS, cradleW: 70 }).cradleW).toBe(70);
    const r = resolveProbe({ ...DEFAULT_PARAMS, cradleW: 70, probePreset: 'clariusHD3' });
    expect(r).toMatchObject({ cradleW: 80, cradleD: 36, verified: false });
  });
  it('every preset cradle is published size + PROBE_CLEARANCE and inside the slider ranges', () => {
    for (const x of PROBE_PRESETS.filter((q) => q.id !== 'custom')) {
      expect(x.verified, x.id).toBe(false);
      expect(x.cradleW, x.id).toBe(x.probeW! + PROBE_CLEARANCE);
      expect(x.cradleD, x.id).toBe(x.probeD! + PROBE_CLEARANCE);
      expect(x.cradleW).toBeGreaterThanOrEqual(RANGES.cradleW.min);
      expect(x.cradleW).toBeLessThanOrEqual(RANGES.cradleW.max);
      expect(x.cradleD).toBeGreaterThanOrEqual(RANGES.cradleD.min);
      expect(x.cradleD).toBeLessThanOrEqual(RANGES.cradleD.max);
      const r = resolveProbe({ ...DEFAULT_PARAMS, probePreset: x.id });
      expect([r.cradleW, r.cradleD]).toEqual([x.cradleW, x.cradleD]);
    }
    expect(PROBE_PRESETS.map((x) => x.id)).toEqual(['custom', 'butterflyIQ3', 'vscanAirCL', 'clariusHD3']);
  });
});
