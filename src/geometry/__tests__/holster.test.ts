import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, STRAP_Z0, WINDOW_Z1_FRAC, buildPartIn, clampParams, Scope, loadManifold, type ManifoldApi } from '../index';
import report from '../../../reference/report.json';

let api: ManifoldApi;
beforeAll(async () => { api = await loadManifold(); });

function measure(p: Parameters<typeof clampParams>[0]) {
  const s = new Scope(api);
  try {
    const m = buildPartIn(s, 'holster', clampParams(p));
    const bb = m.boundingBox();
    return { status: m.status(), volume: m.volume() / 1000, genus: m.genus(), size: [0, 1, 2].map((i) => bb.max[i]! - bb.min[i]!) };
  } finally { s.dispose(); }
}

describe('holster', () => {
  it('defaults match report.json', () => {
    const t0 = performance.now();
    const r = measure(DEFAULT_PARAMS);
    const ms = performance.now() - t0;
    const ref = (report as any).POCUS_Holster.volume_cm3 as number;
    const diff = ((r.volume - ref) / ref) * 100;
    process.stderr.write('\n' + `holster volume ${r.volume.toFixed(2)} cm3 vs ${ref} (${diff.toFixed(2)}%), bbox ${r.size.map((x) => x.toFixed(2))}, genus ${r.genus}, ${ms.toFixed(0)} ms`);
    expect(r.status).toBe('NoError');
    expect(Math.abs(diff)).toBeLessThan(5);
    expect(r.size[0]).toBeCloseTo(80, 1);
    expect(r.size[1]).toBeCloseTo(59.75, 1);
    expect(r.size[2]).toBeCloseTo(100, 1);
  });

  const corners: any[] = [];
  for (const cradleW of [30, 80]) for (const cradleD of [20, 60]) for (const holsterH of [100, 160]) for (const tolerance of [0.15, 0.4])
    corners.push({ cradleW, cradleD, holsterH, tolerance, probePreset: 'custom' });
  it.each(corners)('corner %o', (c) => {
    const r = measure(c);
    process.stderr.write('\n' + `corner W${c.cradleW} D${c.cradleD} H${c.holsterH} tol${c.tolerance}: ${r.volume.toFixed(1)} cm3 genus ${r.genus} bbox ${r.size.map((x) => x.toFixed(1))}`);
    expect(r.status).toBe('NoError');
    expect(r.volume).toBeGreaterThan(0);
    // Genus is derived, not arbitrary: through-openings between cavity and outside (drain, front window, front and
    // back strap slots = 4) + pin tunnels through the two side rails (2) + pin holes through the plate block's two
    // walls (2) = 8. When the window (top 0.80h) reaches the strap slot (z 88) the two merge into one opening: 7.
    expect(r.genus).toBe(c.holsterH * WINDOW_Z1_FRAC > STRAP_Z0 ? 7 : 8);
    for (const x of r.size) expect(x).toBeLessThanOrEqual(250);
  });
});
