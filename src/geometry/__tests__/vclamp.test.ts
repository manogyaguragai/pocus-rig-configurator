import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS, PLATE_T, VCLAMP_HOSE_Z, VCLAMP_INSERT_DEPTH, VCLAMP_INSERT_R, VCLAMP_MIN_WALL, VCLAMP_V_Z0,
  VCLAMP_V_Z1, VCLAMP_ZIP_H, VCLAMP_ZIP_Z, Scope, buildPart, buildPartIn, loadManifold, type ManifoldApi,
} from '../index';
import { VCLAMP_APEX_Y, VCLAMP_TUNNEL_CEIL_Y, VCLAMP_Y0 } from '../parts/vclamp';

let api: ManifoldApi;
beforeAll(async () => { api = await loadManifold(); });
const P = { ...DEFAULT_PARAMS, mount: 'ivpole' as const };

describe('vclamp', () => {
  it('manifold; volume printed vs reference 87.59', async () => {
    const r = await buildPart('vclamp', P, api);
    expect(r.status).toBe('NoError');
    const v = r.volume / 1000;
    // The tunnels were only moved (same size, still inside solid material), so volume must match the reference.
    expect(Math.abs(v - 87.59) / 87.59).toBeLessThanOrEqual(0.005);
    console.log(`vclamp volume ${v.toFixed(2)} cm3 vs 87.59 (${(((v - 87.59) / 87.59) * 100).toFixed(1)}%), print bbox ${[0, 1, 2].map((i) => (r.printBBox.max[i]! - r.printBBox.min[i]!).toFixed(1)).join(' x ')}`);
  });

  it('wall under the V >= 4 mm (analytic and measured)', () => {
    const wallAnalytic = VCLAMP_APEX_Y - VCLAMP_TUNNEL_CEIL_Y;
    const plateWall = VCLAMP_TUNNEL_CEIL_Y - 4 - VCLAMP_Y0; // plate-side wall behind tunnels
    console.log(`vclamp wall under V ${wallAnalytic} mm, plate-side wall behind tunnels ${plateWall} mm`);
    expect(wallAnalytic).toBeGreaterThanOrEqual(VCLAMP_MIN_WALL);
    // measured: slice thin columns along y at x=0 and check solid between ceiling and apex
    const s = new Scope(api);
    try {
      const m = buildPartIn(s, 'vclamp', P);
      for (const z of [23.5, 50, 76.5]) {
        const col = s.box(-0.05, 0.05, VCLAMP_TUNNEL_CEIL_Y, VCLAMP_APEX_Y, z - 0.5, z + 0.5);
        const solid = s.intersect(m, col).volume();
        expect(solid).toBeCloseTo(col.volume(), 6); // fully solid above every tunnel at the apex line
      }
      const tunnelZs = [VCLAMP_HOSE_Z[0], ...VCLAMP_ZIP_Z];
      expect(tunnelZs.length).toBe(3);
      expect(VCLAMP_V_Z0).toBeLessThan(VCLAMP_ZIP_Z[0]);
      expect(VCLAMP_V_Z1).toBeGreaterThan(VCLAMP_ZIP_Z[1] + VCLAMP_ZIP_H);
      // the V flank (45 deg) is further from a flat ceiling than the apex, so apex wall is the minimum
    } finally { s.dispose(); }
  });

  it('heat-set insert holes do not collide with tunnels (z ranges disjoint)', () => {
    const insertZ: [number, number][] = [31, 69].map((c) => [c - VCLAMP_INSERT_R, c + VCLAMP_INSERT_R]);
    const tunnels: [number, number][] = [[VCLAMP_HOSE_Z[0], VCLAMP_HOSE_Z[1]], ...VCLAMP_ZIP_Z.map((z): [number, number] => [z, z + VCLAMP_ZIP_H])];
    for (const [a, b] of insertZ) for (const [c, d] of tunnels) expect(b < c || d < a).toBe(true);
    expect(PLATE_T + VCLAMP_INSERT_DEPTH - 1).toBeLessThan(VCLAMP_APEX_Y);
    // measured: min distance in z between insert and tunnel
    const gaps = insertZ.flatMap(([a, b]) => tunnels.map(([c, d]) => Math.max(c - b, a - d)));
    console.log(`min z gap insert-to-tunnel ${Math.min(...gaps).toFixed(2)} mm`);
  });
});
