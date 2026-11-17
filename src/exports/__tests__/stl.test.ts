import { describe, expect, it } from 'vitest';
import { encodeBinaryStl } from '../stl';
import { calibrationZipName, kitZipName, PART_FILE_NAMES, stlFileName, tolToken } from '../names';
import { PART_META, type PartId } from '../../geometry/types';

// tetrahedron, outward winding
const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3]);
const idx = new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 0, 3, 2]);

function parse(b: Uint8Array) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const n = v.getUint32(80, true);
  const tris = [];
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50;
    const f = (k: number) => v.getFloat32(o + k * 4, true);
    tris.push({ n: [f(0), f(1), f(2)], v: [[f(3), f(4), f(5)], [f(6), f(7), f(8)], [f(9), f(10), f(11)]], attr: v.getUint16(o + 48, true) });
  }
  return { n, tris, header: new TextDecoder().decode(b.subarray(0, 80)).replace(/\0+$/, '') };
}

describe('encodeBinaryStl', () => {
  const out = encodeBinaryStl(pos, idx, 'Holster');
  const p = parse(out);
  it('has 84 + 50n bytes and the triangle count', () => {
    expect(p.n).toBe(4);
    expect(out.byteLength).toBe(84 + 50 * 4);
  });
  it('header holds only the project name', () => {
    expect(p.header).toBe('POCUS Rig Holster');
    expect(out.subarray(17, 80).every((b) => b === 0)).toBe(true);
  });
  it('normals are unit and match the winding', () => {
    for (const t of p.tris) expect(Math.hypot(...(t.n as [number, number, number]))).toBeCloseTo(1, 5);
    expect(p.tris[0]!.n).toEqual([0, 0, -1]);
    expect(p.tris[0]!.attr).toBe(0);
  });
  it('round-trips the input vertices', () => {
    for (let t = 0; t < 4; t++)
      for (let k = 0; k < 3; k++) expect(p.tris[t]!.v[k]).toEqual([...pos.subarray(idx[t * 3 + k]! * 3, idx[t * 3 + k]! * 3 + 3)]);
  });
  it('empty mesh is a valid 84-byte file', () => {
    expect(encodeBinaryStl(new Float32Array(0), new Uint32Array(0)).byteLength).toBe(84);
  });
});

describe('file names', () => {
  it('tolerance token', () => {
    expect(tolToken(0.25)).toBe('0p25');
    expect(tolToken(0.4)).toBe('0p40');
    expect(tolToken(0.15)).toBe('0p15');
  });
  it('every part has a unique name matching PART_META', () => {
    const ids = Object.keys(PART_META) as PartId[];
    expect(new Set(Object.values(PART_FILE_NAMES)).size).toBe(ids.length);
    for (const id of ids) expect(PART_FILE_NAMES[id]).toBe(PART_META[id].fileName);
  });
  it('patterns', () => {
    expect(stlFileName('holster', 0.25)).toBe('POCUS_Holster_tol0p25.stl');
    expect(stlFileName('caddy', 0.25)).toBe('POCUS_GelCaddy_tol0p25.stl');
    expect(stlFileName('gloveTube', 0.3)).toBe('POCUS_GloveTube_tol0p30.stl');
    expect(stlFileName('gloveBox', 0.25)).toBe('POCUS_GloveBox_tol0p25.stl');
    expect(stlFileName('plate', 0.25)).toBe('POCUS_WallPlate_tol0p25.stl');
    expect(stlFileName('vclamp', 0.25)).toBe('POCUS_VClamp_tol0p25.stl');
    expect(stlFileName('calibMale', 0.25)).toBe('POCUS_CalibMale_tol0p25.stl');
    expect(stlFileName('calibFemaleLo', 0.25)).toBe('POCUS_CalibSlotLo_tol0p25.stl');
    expect(stlFileName('calibFemale', 0.25)).toBe('POCUS_CalibSlot_tol0p25.stl');
    expect(stlFileName('calibFemaleHi', 0.25)).toBe('POCUS_CalibSlotHi_tol0p25.stl');
    expect(kitZipName(0.25)).toBe('POCUS_PrintKit_tol0p25.zip');
    expect(calibrationZipName(0.25)).toBe('POCUS_Calibration_tol0p25.zip');
  });
});
