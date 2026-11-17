import { beforeAll, describe, expect, it } from 'vitest';
import {
  ASSEMBLY_LIFT_Z, DEFAULT_PARAMS, Scope, activeParts, assemblyOffset, buildAll, buildPart, buildPartIn,
  clampParams, loadManifold, PROBE_PRESETS, type Manifold, type ManifoldApi, type Params, type PartId,
} from '../index';
import { checkMeshEdges } from '../meshCheck';
import { makePlateReference } from '../parts/plate';

let api: ManifoldApi;
beforeAll(async () => { api = await loadManifold(); });
const err = (s: string) => process.stderr.write(s + '\n');
const EPS = 1e-6; // mm3

/** Criterion 3 rig pairs; a pair applies when both parts are active. */
const RIG_PAIRS: [PartId, PartId][] = [
  ['plate', 'holster'], ['holster', 'caddy'], ['holster', 'gloveTube'], ['holster', 'gloveBox'],
  ['caddy', 'gloveTube'], ['caddy', 'gloveBox'], ['plate', 'caddy'], ['plate', 'gloveTube'],
  ['plate', 'gloveBox'], ['vclamp', 'plate'],
];

function expectManifold(r: { id: string; status: string; mesh: Parameters<typeof checkMeshEdges>[0]; printMesh: Parameters<typeof checkMeshEdges>[0] }, tag: string) {
  expect(r.status, `${tag} ${r.id} status`).toBe('NoError');
  for (const [name, mesh] of [['mesh', r.mesh], ['printMesh', r.printMesh]] as const) {
    const e = checkMeshEdges(mesh);
    expect(e.nonManifoldEdges, `${tag} ${r.id} ${name} non-manifold edges`).toBe(0);
    // Zero-area tris from two doubles that round to one float32 position (e.g. calibMale, 0.6 vs 0.6+1e-16)
    // are an export-precision artifact, not a topology defect: reported, not asserted.
    if (e.degenerateTris) err(`note: ${tag} ${r.id} ${name} has ${e.degenerateTris} float32-collapsed tris`);
  }
}

/** Assembled-pose (+35 z lift) solids for the active rig parts, owned by s. */
function assembled(s: Scope, p: Params): Map<PartId, Manifold> {
  const out = new Map<PartId, Manifold>();
  for (const id of activeParts(p)) {
    const [x, y, z] = assemblyOffset(id, false);
    expect(z).toBe(ASSEMBLY_LIFT_Z);
    out.set(id, s.translate(buildPartIn(s, id, p), x, y, z));
  }
  return out;
}

function pairIntersections(s: Scope, parts: Map<PartId, Manifold>): { pair: string; vol: number }[] {
  const res: { pair: string; vol: number }[] = [];
  for (const [a, b] of RIG_PAIRS) {
    const ma = parts.get(a), mb = parts.get(b);
    if (!ma || !mb) continue;
    res.push({ pair: `${a}-${b}`, vol: s.intersect(ma, mb).volume() });
  }
  return res;
}

function calibIntersections(s: Scope, p: Params): { pair: string; vol: number }[] {
  const male = buildPartIn(s, 'calibMale', p);
  return (['calibFemaleLo', 'calibFemale', 'calibFemaleHi'] as const).map((f) => ({
    pair: `calibMale-${f}`, vol: s.intersect(male, buildPartIn(s, f, p)).volume(),
  }));
}

describe('criterion 1: default volumes vs report.json', () => {
  it('table within +-5% (V-clamp reported only)', async () => {
    const ref = (await import('../../../reference/report.json')).default as unknown as Record<string, { volume_cm3: number }>;
    const rows: { name: string; id: PartId | 'plateRef'; refName: string; checked: boolean }[] = [
      { name: 'holster', id: 'holster', refName: 'POCUS_Holster', checked: true },
      { name: 'caddy', id: 'caddy', refName: 'Gel_Packet_Caddy', checked: true },
      { name: 'gloveTube', id: 'gloveTube', refName: 'Glove_Side_Module', checked: true },
      { name: 'gloveBox', id: 'gloveBox', refName: 'Glove_Side_Module_BoxBracket', checked: true },
      { name: 'plate(ref, all patterns)', id: 'plateRef', refName: 'Universal_Mount_Plate', checked: true },
      { name: 'calibMale', id: 'calibMale', refName: 'Calib_Male', checked: true },
      { name: 'calibFemale', id: 'calibFemale', refName: 'Calib_Female', checked: true },
      { name: 'vclamp (excluded)', id: 'vclamp', refName: 'Mount_IV_Pole_VClamp', checked: false },
    ];
    const lines = ['part                      yours cm3   ref cm3   diff %'];
    const fails: string[] = [];
    for (const r of rows) {
      let v: number;
      if (r.id === 'plateRef') {
        const s = new Scope(api);
        try { v = makePlateReference(s).volume() / 1000; } finally { s.dispose(); }
      } else {
        v = (await buildPart(r.id, DEFAULT_PARAMS, api)).volume / 1000;
      }
      const rv = ref[r.refName]!.volume_cm3;
      const d = ((v - rv) / rv) * 100;
      lines.push(`${r.name.padEnd(25)} ${v.toFixed(2).padStart(9)} ${rv.toFixed(2).padStart(9)} ${d.toFixed(2).padStart(8)}`);
      if (r.checked && Math.abs(d) > 5) fails.push(`${r.name} ${d.toFixed(2)}%`);
    }
    err('\n' + lines.join('\n'));
    expect(fails).toEqual([]);
  });
});

describe('criterion 2: every built mesh is manifold (status + edge check)', () => {
  const ALL: PartId[] = ['holster', 'caddy', 'gloveTube', 'gloveBox', 'plate', 'vclamp', 'calibMale', 'calibFemaleLo', 'calibFemale', 'calibFemaleHi'];
  for (const id of ALL) {
    it(`${id} (mesh and printMesh)`, async () => {
      const r = await buildPart(id, { ...DEFAULT_PARAMS, mount: 'ivpole' }, api);
      expectManifold(r, 'defaults');
    });
  }
  it('meshCheck detects an open mesh and flipped winding', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const tet = new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 0, 3, 2]);
    expect(checkMeshEdges({ positions, indices: tet }).nonManifoldEdges).toBe(0);
    expect(checkMeshEdges({ positions, indices: tet.slice(0, 9) }).nonManifoldEdges).toBeGreaterThan(0);
    const flipped = tet.slice(); flipped[1] = 1; flipped[2] = 2;
    expect(checkMeshEdges({ positions, indices: flipped }).nonManifoldEdges).toBeGreaterThan(0);
  });
});

describe('criterion 3: default assembled-pose intersections are zero', () => {
  it('all rig pairs (ivpole so the V-clamp exists), both glove modes, and calibration pairs', () => {
    const lines: string[] = [];
    const bad: string[] = [];
    for (const gloveMode of ['tube', 'box'] as const) {
      const p = clampParams({ ...DEFAULT_PARAMS, gloveMode, mount: 'ivpole' });
      const s = new Scope(api);
      try {
        for (const { pair, vol } of pairIntersections(s, assembled(s, p))) {
          lines.push(`${gloveMode} ${pair}: ${vol}`);
          if (!(vol < EPS)) bad.push(`${pair} (${gloveMode}) ${vol} mm3`);
        }
        if (gloveMode === 'tube') for (const { pair, vol } of calibIntersections(s, p)) {
          lines.push(`${pair}: ${vol}`);
          if (!(vol < EPS)) bad.push(`${pair} ${vol} mm3`);
        }
      } finally { s.dispose(); }
    }
    err('\nintersections at defaults:\n' + lines.join('\n'));
    expect(bad).toEqual([]);
  });
});

describe('criterion 4: all 320 parameter-space corners', () => {
  it('active parts, manifold, bbox <= 250, no intersections', async () => {
    const t0 = Date.now();
    const bad: string[] = [];
    let n = 0;
    let maxDim = 0;
    for (const tolerance of [0.15, 0.4])
      for (const cradleW of [30, 80])
        for (const cradleD of [20, 60])
          for (const holsterH of [100, 160])
            for (const gelH of [85, 200])
              for (const gloveMode of ['tube', 'box'] as const)
                for (const mount of ['tape', 'vesa', 'amps', 'magnets', 'ivpole'] as const) {
                  const p = clampParams({ ...DEFAULT_PARAMS, tolerance, cradleW, cradleD, holsterH, gelH, gloveMode, mount });
                  const tag = `tol${tolerance} W${cradleW} D${cradleD} H${holsterH} G${gelH} ${gloveMode} ${mount}`;
                  n++;
                  // which parts exist
                  const results = await buildAll(p, api);
                  const ids = results.map((r) => r.id).sort();
                  const want = activeParts(p).sort();
                  if (JSON.stringify(ids) !== JSON.stringify(want)) bad.push(`${tag}: parts ${ids} != ${want}`);
                  if (gloveMode === 'tube' && ids.includes('gloveBox')) bad.push(`${tag}: gloveBox built in tube mode`);
                  if (gloveMode === 'box' && ids.includes('gloveTube')) bad.push(`${tag}: gloveTube built in box mode`);
                  if (ids.includes('vclamp') !== (mount === 'ivpole')) bad.push(`${tag}: vclamp presence wrong`);
                  for (const r of results) {
                    if (r.status !== 'NoError') bad.push(`${tag} ${r.id}: status ${r.status}`);
                    const e1 = checkMeshEdges(r.mesh), e2 = checkMeshEdges(r.printMesh);
                    if (e1.nonManifoldEdges) bad.push(`${tag} ${r.id}: mesh edges ${JSON.stringify(e1)}`);
                    if (e2.nonManifoldEdges) bad.push(`${tag} ${r.id}: printMesh edges ${JSON.stringify(e2)}`);
                    for (let a = 0; a < 3; a++) {
                      const d = r.printBBox.max[a]! - r.printBBox.min[a]!;
                      maxDim = Math.max(maxDim, d);
                      if (d > 250) bad.push(`${tag} ${r.id}: print bbox axis ${a} = ${d.toFixed(1)}`);
                    }
                  }
                  const s = new Scope(api);
                  try {
                    for (const { pair, vol } of pairIntersections(s, assembled(s, p)))
                      if (!(vol < EPS)) bad.push(`${tag} ${pair}: intersection ${vol} mm3`);
                    for (const { pair, vol } of calibIntersections(s, p))
                      if (!(vol < EPS)) bad.push(`${tag} ${pair}: intersection ${vol} mm3`);
                  } finally { s.dispose(); }
                }
    err(`\ncorners: ${n} combos, ${bad.length} failures, max print dim ${maxDim.toFixed(1)} mm, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (bad.length) err(bad.slice(0, 60).join('\n'));
    expect(n).toBe(320);
    expect(bad).toEqual([]);
  }, 1_800_000);
});

describe('user module and plate sizes: extremes stay valid and never collide', () => {
  it('gel, glove and plate size corners at the cradle extremes', async () => {
    const bad: string[] = [];
    let n = 0;
    for (const [cradleW, cradleD] of [[30, 20], [80, 60]] as const)
      for (const lo of [true, false])
        for (const gloveMode of ['tube', 'box'] as const)
          for (const mount of ['vesa', 'ivpole'] as const) {
            const sizes = lo
              ? { gelW: 40, gloveBoxW: 90, gloveBoxH: 50, tubeD: 40, tubeH: 70, plateW: 120, plateH: 150 }
              : { gelW: 90, gloveBoxW: 180, gloveBoxH: 150, tubeD: 90, tubeH: 200, plateW: 250, plateH: 250 };
            const p = clampParams({ ...DEFAULT_PARAMS, cradleW, cradleD, gloveMode, mount, ...sizes });
            const tag = `W${cradleW} D${cradleD} ${lo ? 'min' : 'max'} sizes ${gloveMode} ${mount}`;
            n++;
            for (const r of await buildAll(p, api)) {
              if (r.status !== 'NoError') bad.push(`${tag} ${r.id}: status ${r.status}`);
              if (checkMeshEdges(r.mesh).nonManifoldEdges || checkMeshEdges(r.printMesh).nonManifoldEdges) bad.push(`${tag} ${r.id}: non-manifold`);
              for (let a = 0; a < 3; a++) {
                const d = r.printBBox.max[a]! - r.printBBox.min[a]!;
                if (d > 250) bad.push(`${tag} ${r.id}: print bbox axis ${a} = ${d.toFixed(1)}`);
              }
            }
            const s = new Scope(api);
            try {
              for (const { pair, vol } of pairIntersections(s, assembled(s, p)))
                if (!(vol < EPS)) bad.push(`${tag} ${pair}: intersection ${vol} mm3`);
            } finally { s.dispose(); }
          }
    if (bad.length) err(bad.slice(0, 40).join('\n'));
    expect(n).toBe(16);
    expect(bad).toEqual([]);
  }, 600_000);
});

describe('probe presets: manifold, fit 250 mm, no mating intersections', () => {
  it('every preset at defaults and at corners', async () => {
    const bad: string[] = [];
    let n = 0;
    for (const preset of PROBE_PRESETS.map((x) => x.id).filter((id) => id !== 'custom'))
      for (const [tolerance, holsterH, gelH] of [[0.25, 100, 125], [0.15, 100, 85], [0.4, 160, 200], [0.15, 160, 200], [0.4, 100, 85]] as const)
        for (const gloveMode of ['tube', 'box'] as const)
          for (const mount of ['tape', 'ivpole'] as const) {
            const p = clampParams({ ...DEFAULT_PARAMS, probePreset: preset, tolerance, holsterH, gelH, gloveMode, mount });
            const tag = `${preset} tol${tolerance} H${holsterH} G${gelH} ${gloveMode} ${mount}`;
            n++;
            for (const r of await buildAll(p, api)) {
              if (r.status !== 'NoError') bad.push(`${tag} ${r.id}: status ${r.status}`);
              if (checkMeshEdges(r.mesh).nonManifoldEdges || checkMeshEdges(r.printMesh).nonManifoldEdges) bad.push(`${tag} ${r.id}: non-manifold`);
              for (let a = 0; a < 3; a++) {
                const d = r.printBBox.max[a]! - r.printBBox.min[a]!;
                if (d > 250) bad.push(`${tag} ${r.id}: print bbox axis ${a} = ${d.toFixed(1)}`);
              }
            }
            const s = new Scope(api);
            try {
              for (const { pair, vol } of pairIntersections(s, assembled(s, p)))
                if (!(vol < EPS)) bad.push(`${tag} ${pair}: intersection ${vol} mm3`);
            } finally { s.dispose(); }
          }
    err(`\npreset checks: ${n} combos, ${bad.length} failures`);
    if (bad.length) err(bad.slice(0, 40).join('\n'));
    expect(n).toBe(60);
    expect(bad).toEqual([]);
  }, 600_000);
});
