import { printMatrix } from '../geometry/placement';
import type { PartId } from '../geometry/types';

export type RawMesh = { positions: Float32Array; indices: Uint32Array };
export type PrintMesh = RawMesh & { id: PartId };

/**
 * Applies the geometry's print orientation (placement.ts printMatrix) to a Blender-frame
 * mesh as a pure vertex transform: rotate per part, centre in XY, min z = 0. No CSG.
 * Both rotations used are proper (det +1), so triangle winding is unchanged.
 */
export function toPrintMesh(id: PartId, mesh: RawMesh): PrintMesh {
  const p = mesh.positions;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const v = p[i + k]!;
      if (v < min[k]!) min[k] = v;
      if (v > max[k]!) max[k] = v;
    }
  const m = printMatrix(id, { min, max });
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i]!, y = p[i + 1]!, z = p[i + 2]!;
    out[i] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    out[i + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    out[i + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
  }
  return { id, positions: out, indices: mesh.indices };
}

export function meshBBox(mesh: RawMesh): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const p = mesh.positions;
  for (let i = 0; i < p.length; i += 3)
    for (let k = 0; k < 3; k++) {
      if (p[i + k]! < min[k]!) min[k] = p[i + k]!;
      if (p[i + k]! > max[k]!) max[k] = p[i + k]!;
    }
  return { min, max };
}
