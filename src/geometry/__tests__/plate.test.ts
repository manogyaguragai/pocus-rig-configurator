import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, Scope, buildPart, loadManifold, type ManifoldApi, type Params } from '../index';
import { makePlateReference } from '../parts/plate';

let api: ManifoldApi;
beforeAll(async () => { api = await loadManifold(); });
const MOUNTS: Params['mount'][] = ['tape', 'vesa', 'amps', 'magnets', 'ivpole'];

describe('plate', () => {
  it('reference (all patterns) volume within 5% of report 160.14 cm3', () => {
    const s = new Scope(api);
    try {
      const m = makePlateReference(s);
      expect(m.status()).toBe('NoError');
      const v = m.volume() / 1000;
      const diff = ((v - 160.14) / 160.14) * 100;
      console.log(`plate reference volume ${v.toFixed(2)} cm3 vs 160.14, diff ${diff.toFixed(2)}%`);
      expect(Math.abs(diff)).toBeLessThanOrEqual(5);
    } finally { s.dispose(); }
  });

  for (const mount of MOUNTS) {
    it(`mount ${mount}: manifold, print bbox <= 250`, async () => {
      const r = await buildPart('plate', { ...DEFAULT_PARAMS, mount }, api);
      expect(r.status).toBe('NoError');
      const d = [0, 1, 2].map((i) => r.printBBox.max[i]! - r.printBBox.min[i]!);
      console.log(`plate ${mount}: vol ${(r.volume / 1000).toFixed(2)} cm3, print bbox ${d.map((x) => x.toFixed(1)).join(' x ')}`);
      d.forEach((x) => expect(x).toBeLessThanOrEqual(250));
    });
  }

  it('branches differ: tape has the most material, only chosen holes cut', async () => {
    const v: Record<string, number> = {};
    for (const mount of MOUNTS) v[mount] = (await buildPart('plate', { ...DEFAULT_PARAMS, mount }, api)).volume;
    expect(v.tape).toBeGreaterThan(v.amps!);
    expect(v.amps).toBeCloseTo(v.ivpole!, 3);
    expect(v.vesa).toBeLessThan(v.amps!);
    expect(v.magnets).toBeLessThan(v.tape!);
  });
});
