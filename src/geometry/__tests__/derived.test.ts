import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUILDERS, DEFAULT_PARAMS, PART_DEPS, STRAP_Z0, STRAP_Z1, WINDOW_Z0_FRAC, WINDOW_Z1_FRAC, RIG_PARTS,
  CALIB_PARTS, Scope, addMaleRail, clampParams, layout, loadManifold, type ManifoldApi, type Params, type PartId,
} from '../index';

let api: ManifoldApi;
beforeAll(async () => { api = await loadManifold(); });
const ALL: PartId[] = [...RIG_PARTS, ...CALIB_PARTS];
const P = (o: Partial<Params>): Params => ({ ...DEFAULT_PARAMS, ...o });

function mesh(id: PartId, p: Partial<Params>) {
  const s = new Scope(api);
  try { return s.meshData(BUILDERS[id](s, p as Params)); } finally { s.dispose(); }
}
const same = (a: ReturnType<typeof mesh>, b: ReturnType<typeof mesh>) =>
  a.positions.length === b.positions.length && a.indices.length === b.indices.length &&
  a.positions.every((v, i) => v === b.positions[i]) && a.indices.every((v, i) => v === b.indices[i]);

describe('SPEC 4a clamping inside the builder path', () => {
  const wild: Partial<Record<keyof Params, unknown>>[] = [
    { tolerance: 9, cradleW: 5, cradleD: 500, holsterH: 3, gelH: 1000 },
    { tolerance: -1, cradleW: 1e6, cradleD: -4, holsterH: 9999, gelH: -5, mount: 'nope', gloveMode: 'x' },
    { tolerance: NaN, cradleW: NaN, holsterH: undefined, gelH: Infinity, mount: 'ivpole', gloveMode: 'box' },
  ];
  for (const [i, raw] of wild.entries()) {
    it(`out-of-range params #${i} give the same mesh as clamped ones, for every part`, () => {
      const clamped = clampParams(raw as Partial<Params>);
      for (const id of ALL) expect(same(mesh(id, raw as Partial<Params>), mesh(id, clamped)), id).toBe(true);
    });
    it(`layout() clamps #${i}`, () => {
      expect(layout(raw as Partial<Params>)).toEqual(layout(clampParams(raw as Partial<Params>)));
    });
  }
});

describe('PART_DEPS matches reality', () => {
  const perturb: Record<keyof Params, Partial<Params>> = {
    tolerance: { tolerance: 0.4 },
    probePreset: { probePreset: 'butterflyIQ3' },
    cradleW: { cradleW: 70 },
    cradleD: { cradleD: 50 },
    holsterH: { holsterH: 130 },
    gelH: { gelH: 150 },
    gloveMode: { gloveMode: 'box' },
    mount: { mount: 'vesa' },
  };
  const base = new Map<PartId, ReturnType<typeof mesh>>();
  const baseMesh = (id: PartId) => {
    if (!base.has(id)) base.set(id, mesh(id, DEFAULT_PARAMS));
    return base.get(id)!;
  };
  for (const id of ALL) {
    for (const key of Object.keys(perturb) as (keyof Params)[]) {
      const listed = PART_DEPS[id].includes(key);
      // Known, documented exceptions where "listed" does not change the mesh:
      //  - probePreset: every preset is still the 62 x 44 placeholder (TODO(measure)), so the mesh is identical.
      //  - vclamp/mount: mount decides whether the V-clamp EXISTS; the solid itself has no parameters.
      const meshIndependent = key === 'probePreset' || (id === 'vclamp' && key === 'mount');
      it(`${id}: ${key} ${listed ? 'is listed' : 'is not listed'}`, () => {
        const changed = !same(baseMesh(id), mesh(id, P(perturb[key])));
        if (!listed) expect(changed, 'unlisted param changed the mesh').toBe(false);
        else if (!meshIndependent) expect(changed, 'listed param did not change the mesh').toBe(true);
      });
    }
  }
});

describe('holster dependent features', () => {
  const holsterSolid = (s: Scope, p: Partial<Params>) => BUILDERS.holster(s, p as Params);

  for (const holsterH of [100, 130, 160]) {
    it(`h=${holsterH}: strap slots stay at z ${STRAP_Z0}..${STRAP_Z1}`, () => {
      const s = new Scope(api);
      try {
        const m = holsterSolid(s, P({ holsterH }));
        // thin column through the back wall (y -9.5..-8.5 (wall; back face is y = -8)): x +-5, z 86..94
        const col = s.box(-5, 5, -9.5, -8.5, STRAP_Z0 - 2, STRAP_Z1 + 2);
        // solid only in the two 2 mm bands outside the slot
        expect(s.intersect(m, col).volume()).toBeCloseTo(10 * 1 * 4, 4);
        const inside = s.box(-5, 5, -9.5, -8.5, STRAP_Z0 + 0.1, STRAP_Z1 - 0.1);
        expect(s.intersect(m, inside).volume()).toBe(0);
      } finally { s.dispose(); }
    });

    it(`h=${holsterH}: front window z follows ${WINDOW_Z0_FRAC}h..${WINDOW_Z1_FRAC}h`, () => {
      const s = new Scope(api);
      try {
        const L = layout(P({ holsterH }));
        const yFront = L.hcY - L.holsterD / 2;
        const m = holsterSolid(s, P({ holsterH }));
        const slab = (z0: number, z1: number) =>
          s.intersect(m, s.box(-5, 5, yFront + 0.5, yFront + 1.5, z0, z1)).volume();
        const z0 = WINDOW_Z0_FRAC * holsterH, z1 = WINDOW_Z1_FRAC * holsterH;
        expect(slab(z0 + 0.1, z1 - 0.1)).toBe(0); // open
        expect(slab(z0 - 1, z0 - 0.1)).toBeCloseTo(10 * 0.9, 4); // solid just below
        expect(slab(z1 + 0.1, z1 + 1)).toBeCloseTo(10 * 0.9, 4); // solid just above
      } finally { s.dispose(); }
    });
  }
});

describe('caddy dependent features', () => {
  for (const gelH of [85, 160, 200]) {
    it(`gelH=${gelH}: height = gelH + 3, view slot z 35..gelH-13`, () => {
      const s = new Scope(api);
      try {
        const p = P({ gelH });
        const L = layout(p);
        const m = BUILDERS.caddy(s, p);
        const bb = m.boundingBox();
        expect(bb.max[2]).toBeCloseTo(gelH + 3, 6);
        const cx = L.moduleInnerX + (55 + 6) / 2;
        const yFront = -8 - (35 + 6);
        const slab = (z0: number, z1: number) =>
          s.intersect(m, s.box(cx - 2, cx + 2, yFront + 0.5, yFront + 1.5, z0, z1)).volume();
        expect(slab(35.1, gelH - 13 - 0.1)).toBe(0);
        expect(slab(34, 34.9)).toBeCloseTo(4 * 0.9, 4);
        expect(slab(gelH - 13 + 0.1, gelH - 12)).toBeCloseTo(4 * 0.9, 4);
      } finally { s.dispose(); }
    });
  }
});

describe('tape plate', () => {
  it('has no holes: volume equals the flat plate + rail, and only the pin tunnel is a handle', () => {
    const s = new Scope(api);
    try {
      const tape = BUILDERS.plate(s, P({ mount: 'tape' }));
      const flat = addMaleRail(s, s.box(-62, 62, 0, 8, -35, 135, 3), layout(DEFAULT_PARAMS).frPlate);
      expect(tape.volume()).toBeCloseTo(flat.volume(), 6);
      expect(tape.genus()).toBe(1); // the rail's anti-lift pin tunnel only
      // flat back: nothing is cut from the y = 8 face
      expect(s.intersect(tape, s.box(-40, 40, 7.9, 8, -20, 120)).volume()).toBeCloseTo(80 * 0.1 * 140, 4);
      // and the other mounts all have less material
      for (const mount of ['vesa', 'amps', 'magnets', 'ivpole'] as const)
        expect(BUILDERS.plate(s, P({ mount })).volume()).toBeLessThan(tape.volume());
    } finally { s.dispose(); }
  });
});

