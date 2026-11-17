import { beforeAll, describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { activeParts, buildPart, CALIB_PARTS, clampParams, DEFAULT_PARAMS, loadManifold, RANGES, type Params, type PartId } from '../../geometry';
import type { ManifoldApi } from '../../geometry/manifold';
import { isWatertight } from '../../geometry/meshCheck';
import { buildAssemblyText } from '../assembly';
import { buildCalibrationKit, buildPrintKit, type MeshSet } from '../kit';
import { meshBBox, toPrintMesh, type PrintMesh } from '../print';
import { build3mf, layoutOnBed, type LayoutBox } from '../threemf';
import { stlFileName } from '../names';

let api: ManifoldApi;
beforeAll(async () => {
  api = await loadManifold();
});

const P = (o: Partial<Params> = {}): Params => clampParams({ ...DEFAULT_PARAMS, ...o });
const worst = P({
  gloveMode: 'box', mount: 'ivpole', probePreset: 'custom', cradleW: RANGES.cradleW.max, cradleD: RANGES.cradleD.max,
  holsterH: RANGES.holsterH.max, gelH: RANGES.gelH.max, tolerance: RANGES.tolerance.max,
});
const small = P({
  gloveMode: 'tube', mount: 'magnets', probePreset: 'custom', cradleW: RANGES.cradleW.min, cradleD: RANGES.cradleD.min,
  holsterH: RANGES.holsterH.min, gelH: RANGES.gelH.min, tolerance: RANGES.tolerance.min,
});
const CONFIGS: [string, Params][] = [
  ['default', P()],
  ['worst', worst],
  ['small', small],
  ['vesa box', P({ mount: 'vesa', gloveMode: 'box', tolerance: 0.15 })],
];

const build = (params: Params, ids: readonly PartId[]) => Promise.all(ids.map((id) => buildPart(id, params, api)));

function maxDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  expect(a.length).toBe(b.length);
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i]! - b[i]!));
  return d;
}

const footprint = (id: PartId, mesh: PrintMesh | { positions: Float32Array; indices: Uint32Array }) => {
  const b = meshBBox(mesh);
  return { id, w: b.max[0] - b.min[0], d: b.max[1] - b.min[1] };
};

describe('print orientation as a vertex transform', () => {
  for (const [name, params] of CONFIGS) {
    it(`${name}: equals buildPart printMesh, min z 0, centred, watertight`, async () => {
      for (const r of await build(params, activeParts(params))) {
        const pm = toPrintMesh(r.id, r.mesh);
        expect(maxDiff(pm.positions, r.printMesh.positions), `${r.id} positions`).toBeLessThan(2e-3);
        expect(Array.from(pm.indices)).toEqual(Array.from(r.printMesh.indices));
        const b = meshBBox(pm);
        expect(Math.abs(b.min[2])).toBeLessThan(1e-3);
        expect(Math.abs(b.min[0] + b.max[0])).toBeLessThan(2e-3);
        expect(Math.abs(b.min[1] + b.max[1])).toBeLessThan(2e-3);
        expect(r.status).toBe('NoError');
        expect(isWatertight(pm), `${r.id} watertight`).toBe(true);
      }
    });
  }
  it('calibration pieces are watertight and sit on z = 0', async () => {
    for (const r of await build(P(), CALIB_PARTS)) {
      const pm = toPrintMesh(r.id, r.mesh);
      expect(isWatertight(pm), r.id).toBe(true);
      expect(Math.abs(meshBBox(pm).min[2])).toBeLessThan(1e-3);
    }
  });
});

describe('layoutOnBed', () => {
  const overlap = (a: LayoutBox & { x: number; y: number }, b: LayoutBox & { x: number; y: number }) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
  function check(boxes: LayoutBox[], margin = 3) {
    const l = layoutOnBed(boxes, margin);
    expect(l.fits).toBe(true);
    const placed = boxes.map((b, i) => {
      const pl = l.placements[i]!;
      return { id: b.id, w: pl.rotated ? b.d : b.w, d: pl.rotated ? b.w : b.d, x: pl.x, y: pl.y };
    });
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(256);
      expect(p.y + p.d).toBeLessThanOrEqual(256);
    }
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) expect(overlap(placed[i]!, placed[j]!)).toBe(false);
  }
  it('packs synthetic boxes without overlap', () => {
    check([{ id: 'a', w: 100, d: 100 }, { id: 'b', w: 100, d: 50 }, { id: 'c', w: 50, d: 120 }]);
  });
  it('reports a set that cannot fit', () => {
    expect(layoutOnBed([{ id: 'a', w: 200, d: 200 }, { id: 'b', w: 200, d: 200 }], 3).fits).toBe(false);
  });
  for (const [name, params] of CONFIGS) {
    it(`real parts, ${name}`, async () => {
      const rs = await build(params, activeParts(params));
      check(rs.map((r) => footprint(r.id, toPrintMesh(r.id, r.mesh))));
    });
  }
  it('calibration pieces', async () => {
    const rs = await build(P(), CALIB_PARTS);
    check(rs.map((r) => footprint(r.id, toPrintMesh(r.id, r.mesh))));
  });
});

/** Minimal well-formedness check: tags balance, attributes quoted, one root, no stray text. */
function assertWellFormed(xml: string) {
  const stack: string[] = [];
  let roots = 0;
  const re = /<\?[^>]*\?>|<!--[\s\S]*?-->|<\/([A-Za-z_][\w:.-]*)\s*>|<([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const between = xml.slice(last, m.index);
    if (stack.length === 0) expect(between.trim()).toBe('');
    else expect(between.includes('<')).toBe(false);
    last = re.lastIndex;
    if (m[1]) expect(stack.pop()).toBe(m[1]);
    else if (m[2]) {
      if (stack.length === 0) roots++;
      if (!m[4]) stack.push(m[2]);
    }
  }
  expect(xml.slice(last).trim()).toBe('');
  expect(stack).toEqual([]);
  expect(roots).toBe(1);
}

describe('3MF', () => {
  async function printParts(params: Params, ids: readonly PartId[]): Promise<PrintMesh[]> {
    return (await build(params, ids)).map((r) => toPrintMesh(r.id, r.mesh));
  }
  for (const [name, params] of [['default', P()], ['worst', worst]] as const) {
    it(`valid package, two materials, counts match (${name})`, async () => {
      const parts = await printParts(params, activeParts(params));
      const z = unzipSync(build3mf(parts, params));
      expect(Object.keys(z).sort()).toEqual(['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels']);
      const ct = strFromU8(z['[Content_Types].xml']!);
      expect(ct).toContain('Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"');
      expect(ct).toContain('Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"');
      const rels = strFromU8(z['_rels/.rels']!);
      expect(rels).toContain('Target="/3D/3dmodel.model"');
      expect(rels).toContain('http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel');
      const xml = strFromU8(z['3D/3dmodel.model']!);
      for (const x of [ct, rels, xml]) assertWellFormed(x);
      expect(xml).toContain('unit="millimeter"');
      expect(xml.match(/<basematerials /g)!.length).toBe(1);
      const bases = [...xml.matchAll(/<base name="[^"]*" displaycolor="([^"]+)"\/>/g)].map((m) => m[1]!.toLowerCase());
      expect(bases).toEqual(['#2a3038', '#0b8a73']);
      const objs = [...xml.matchAll(/<object id="(\d+)"[^>]*pid="(\d+)" pindex="(\d+)">([\s\S]*?)<\/object>/g)];
      expect(objs.length).toBe(parts.length);
      expect((xml.match(/<item /g) ?? []).length).toBe(parts.length);
      objs.forEach((o, i) => {
        expect(o[2]).toBe('1');
        const slate = parts[i]!.id === 'plate' || parts[i]!.id === 'vclamp';
        expect(o[3]).toBe(slate ? '0' : '1');
        const nv = (o[4]!.match(/<vertex /g) ?? []).length;
        const tris = [...o[4]!.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)];
        expect(tris.length).toBe(parts[i]!.indices.length / 3);
        for (const t of tris) for (const k of [1, 2, 3]) expect(Number(t[k])).toBeLessThan(nv);
        expect(nv).toBeGreaterThan(0);
        expect(nv).toBeLessThanOrEqual(parts[i]!.positions.length / 3);
        expect(xml).toContain(`<item objectid="${o[1]}"/>`);
      });
      const boxes = objs.map((o) => {
        const v = [...o[4]!.matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g)].map((m) => [+m[1]!, +m[2]!, +m[3]!]);
        const r = (k: number): [number, number] => [Math.min(...v.map((p) => p[k]!)), Math.max(...v.map((p) => p[k]!))];
        return { x: r(0), y: r(1), z: r(2) };
      });
      for (const b of boxes) {
        expect(b.x[0]).toBeGreaterThanOrEqual(0);
        expect(b.x[1]).toBeLessThanOrEqual(256);
        expect(b.y[0]).toBeGreaterThanOrEqual(0);
        expect(b.y[1]).toBeLessThanOrEqual(256);
        expect(b.z[0]).toBeGreaterThanOrEqual(-1e-3);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!, b = boxes[j]!;
          expect(a.x[0] < b.x[1] && b.x[0] < a.x[1] && a.y[0] < b.y[1] && b.y[0] < a.y[1]).toBe(false);
        }
    });
  }
  it('throws when parts cannot fit', () => {
    const big: PrintMesh = { id: 'plate', positions: new Float32Array([0, 0, 0, 300, 0, 0, 0, 10, 10]), indices: new Uint32Array([0, 1, 2]) };
    expect(() => build3mf([big], DEFAULT_PARAMS)).toThrow(/bed/);
  });
});

describe('assembly text', () => {
  const sections = [
    'Print the calibration piece first', 'Parameters (JSON)', 'Parts and print orientation', 'What drops onto what', 'M3 pin positions',
    'Preset probe sizes come from published manufacturer dimensions', 'Dr. Mandeep Guragai and Manogya Guragai',
  ];
  const mountMarks: Record<Params['mount'], string[]> = {
    tape: ['flat back', 'tape'],
    vesa: ['VESA', 'keyholes', '75 mm', '100 mm'],
    amps: ['AMPS', '30 mm x 38 mm'],
    magnets: ['20.4 mm x 4 mm', 'magnet'],
    ivpole: ['V-clamp', 'hose clamp', 'zip ties'],
  };
  for (const mount of Object.keys(mountMarks) as Params['mount'][]) {
    it(`mount ${mount}`, () => {
      const p = P({ mount });
      const t = buildAssemblyText(p, activeParts(p));
      for (const s of sections) expect(t).toContain(s);
      for (const s of mountMarks[mount]) expect(t).toContain(s);
      expect(t).toContain('https://www.linkedin.com/in/mandeep-guragai-280589117/');
      expect(t).toContain('https://www.linkedin.com/in/manogya-guragai/');
      expect(t).toContain('Print each part on its own');
      expect(t).toContain('Plate rail -> holster back slot');
      expect(t).toContain('Holster right rail -> gel caddy slot');
      expect(t).toContain('Holster left rail -> glove tube slot');
      expect(t).toContain('3.4 mm');
      expect(t).toContain('z = 40 mm');
      expect(t).toContain('0.25 mm');
      expect(JSON.parse(t.slice(t.indexOf('{'), t.indexOf('\n}') + 2))).toEqual(p);
      expect(t).not.toMatch(/\bAI\b|\bLLM\b/i);
    });
  }
  it('lists the V-clamp only for the IV pole mount and the box bracket for glove box', () => {
    const p = P({ mount: 'ivpole', gloveMode: 'box' });
    const t = buildAssemblyText(p, activeParts(p));
    expect(t).toContain('POCUS_VClamp_tol0p25.stl');
    expect(t).toContain('glove box bracket slot');
    expect(buildAssemblyText(P(), activeParts(P()))).not.toContain('VClamp');
  });
});

describe('kits', () => {
  async function meshes(params: Params, ids: readonly PartId[]): Promise<MeshSet> {
    return Object.fromEntries((await build(params, ids)).map((r) => [r.id, r.mesh]));
  }
  it('print kit contents', async () => {
    const params = P({ mount: 'ivpole', gloveMode: 'box' });
    const ids = activeParts(params);
    const z = unzipSync(buildPrintKit(params, await meshes(params, ids)));
    expect(Object.keys(z).sort()).toEqual([...ids.map((i) => stlFileName(i, 0.25)), 'ASSEMBLY.txt', 'POCUS_Rig_tol0p25.3mf'].sort());
    const holster = z[stlFileName('holster', 0.25)]!;
    expect(holster.byteLength).toBe(84 + 50 * new DataView(holster.buffer, holster.byteOffset).getUint32(80, true));
    expect(Object.keys(unzipSync(z['POCUS_Rig_tol0p25.3mf']!))).toContain('3D/3dmodel.model');
  });
  it('print kit refuses a missing mesh', () => {
    expect(() => buildPrintKit(P(), {})).toThrow(/Missing mesh/);
  });
  it('calibration kit contents', async () => {
    const z = unzipSync(buildCalibrationKit(P(), await meshes(P(), CALIB_PARTS)));
    expect(Object.keys(z).sort()).toEqual([
      'POCUS_CalibMale_tol0p25.stl', 'POCUS_CalibSlotHi_tol0p25.stl', 'POCUS_CalibSlotLo_tol0p25.stl', 'POCUS_CalibSlot_tol0p25.stl',
      'POCUS_Calibration_tol0p25.3mf',
    ]);
    const xml = strFromU8(unzipSync(z['POCUS_Calibration_tol0p25.3mf']!)['3D/3dmodel.model']!);
    expect((xml.match(/<object /g) ?? []).length).toBe(4);
    assertWellFormed(xml);
  });
});
