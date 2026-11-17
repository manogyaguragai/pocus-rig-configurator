import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, loadManifold, buildPart, type ManifoldApi, type Params, type PartResult } from '../index';

const REF_VOL = 61.83; // cm3, report.json Glove_Side_Module
const REF_DIMS = [63.75, 56, 110]; // report dims_mm
const BED = 250;

let api: ManifoldApi;
beforeAll(async () => { api = await loadManifold(); });

const size = (b: PartResult['bbox']) => [0, 1, 2].map((i) => b.max[i]! - b.min[i]!);

function corners(): Partial<Params>[] {
  const out: Partial<Params>[] = [];
  for (const cradleW of [30, 80]) for (const cradleD of [20, 60]) for (const tolerance of [0.15, 0.4]) out.push({ cradleW, cradleD, tolerance });
  return out;
}
describe('gloveTube', () => {
  it('defaults: volume within 5% and bbox matches report', async () => {
    const t0 = performance.now();
    const r = await buildPart('gloveTube', DEFAULT_PARAMS, api);
    const ms = performance.now() - t0;
    const cm3 = r.volume / 1000;
    const diff = ((cm3 - REF_VOL) / REF_VOL) * 100;
    const d = size(r.bbox);
    console.log('gloveTube vol', cm3.toFixed(2), 'ref', REF_VOL, 'diff', diff.toFixed(2) + '%', 'bbox', d.map((v) => v.toFixed(2)).join(' x '), 'tris', r.numTri, 'build ms', ms.toFixed(0));
    expect(r.status).toBe('NoError');
    expect(Math.abs(diff)).toBeLessThanOrEqual(5);
    d.forEach((v, i) => expect(Math.abs(v - REF_DIMS[i]!)).toBeLessThan(0.3));
  });

  it('every corner is manifold and fits the bed', async () => {
    let worst = 0;
    for (const c of corners()) {
      const p: Params = { ...DEFAULT_PARAMS, ...c };
      const t0 = performance.now();
      const r = await buildPart('gloveTube', p, api);
      worst = Math.max(worst, performance.now() - t0);
      const tag = JSON.stringify(c);
      expect(r.status, tag).toBe('NoError');
      expect(r.volume, tag).toBeGreaterThan(0);
      size(r.printBBox).forEach((v) => expect(v, tag).toBeLessThanOrEqual(BED));
    }
    console.log('gloveTube worst corner build ms', worst.toFixed(0));
  }, 120000);

  it('tube stays off the plate plane at small and large cradleD, single piece', async () => {
    const { withScope, buildPartIn } = await import('../index');
    for (const cradleD of [20, 60]) {
      withScope(api, (s) => {
        const m = buildPartIn(s, 'gloveTube', { ...DEFAULT_PARAMS, cradleD });
        expect(m.status(), String(cradleD)).toBe('NoError');
        expect(m.boundingBox().max[1]!, String(cradleD)).toBeLessThanOrEqual(-1);
        expect(m.decompose().length, String(cradleD)).toBe(1);
        return s.track(api.Manifold.cube(1));
      });
    }
  });
});
