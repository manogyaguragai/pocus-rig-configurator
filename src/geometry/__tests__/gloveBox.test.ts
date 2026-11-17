import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, loadManifold, buildPart, type ManifoldApi, type Params, type PartResult } from '../index';

const REF_VOL = 124.53; // cm3, report.json Glove_Side_Module_BoxBracket
const REF_DIMS = [145.75, 93, 84]; // report dims_mm
const BED = 250;

let api: ManifoldApi;
beforeAll(async () => { api = await loadManifold(); });

const size = (b: PartResult['bbox']) => [0, 1, 2].map((i) => b.max[i]! - b.min[i]!);

function corners(): Partial<Params>[] {
  const out: Partial<Params>[] = [];
  for (const cradleW of [30, 80]) for (const cradleD of [20, 60]) for (const tolerance of [0.15, 0.4]) out.push({ cradleW, cradleD, tolerance });
  return out;
}
describe('gloveBox', () => {
  it('defaults: volume within 5% and bbox matches report', async () => {
    const t0 = performance.now();
    const r = await buildPart('gloveBox', DEFAULT_PARAMS, api);
    const ms = performance.now() - t0;
    const cm3 = r.volume / 1000;
    const diff = ((cm3 - REF_VOL) / REF_VOL) * 100;
    const d = size(r.bbox);
    console.log('gloveBox vol', cm3.toFixed(2), 'ref', REF_VOL, 'diff', diff.toFixed(2) + '%', 'bbox', d.map((v) => v.toFixed(2)).join(' x '), 'tris', r.numTri, 'build ms', ms.toFixed(0));
    expect(r.status).toBe('NoError');
    expect(Math.abs(diff)).toBeLessThanOrEqual(5);
    d.forEach((v, i) => expect(Math.abs(v - REF_DIMS[i]!)).toBeLessThan(0.3));
  });

  it('every corner is manifold and fits the bed', async () => {
    let worst = 0;
    for (const c of corners()) {
      const p: Params = { ...DEFAULT_PARAMS, ...c };
      const t0 = performance.now();
      const r = await buildPart('gloveBox', p, api);
      worst = Math.max(worst, performance.now() - t0);
      const tag = JSON.stringify(c);
      expect(r.status, tag).toBe('NoError');
      expect(r.volume, tag).toBeGreaterThan(0);
      size(r.printBBox).forEach((v) => expect(v, tag).toBeLessThanOrEqual(BED));
    }
    console.log('gloveBox worst corner build ms', worst.toFixed(0));
  }, 120000);
});
