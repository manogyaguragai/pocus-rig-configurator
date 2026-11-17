/**
 * Binary STL writer. Layout: 80-byte header, uint32 triangle count, then per triangle
 * 12 float32 (normal, 3 vertices) and a uint16 attribute word (0). Little-endian.
 */
export const STL_HEADER_BYTES = 80;
export const STL_TRI_BYTES = 50;

export function encodeBinaryStl(positions: Float32Array, indices: Uint32Array, name = ''): Uint8Array {
  const n = Math.floor(indices.length / 3);
  const out = new Uint8Array(STL_HEADER_BYTES + 4 + n * STL_TRI_BYTES);
  const view = new DataView(out.buffer);
  // Header carries only the project name (ASCII, truncated, rest zero).
  const label = `POCUS Rig ${name}`.trim().replace(/[^\x20-\x7e]/g, '?').slice(0, STL_HEADER_BYTES);
  for (let i = 0; i < label.length; i++) out[i] = label.charCodeAt(i);
  view.setUint32(STL_HEADER_BYTES, n, true);
  let o = STL_HEADER_BYTES + 4;
  for (let t = 0; t < n; t++) {
    const a = indices[t * 3]! * 3, b = indices[t * 3 + 1]! * 3, c = indices[t * 3 + 2]! * 3;
    const ux = positions[b]! - positions[a]!, uy = positions[b + 1]! - positions[a + 1]!, uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[c]! - positions[a]!, vy = positions[c + 1]! - positions[a + 1]!, vz = positions[c + 2]! - positions[a + 2]!;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 0) { nx /= len; ny /= len; nz /= len; } else { nx = ny = nz = 0; } // zero-area triangle
    view.setFloat32(o, nx, true); view.setFloat32(o + 4, ny, true); view.setFloat32(o + 8, nz, true);
    o += 12;
    for (const p of [a, b, c]) {
      view.setFloat32(o, positions[p]!, true); view.setFloat32(o + 4, positions[p + 1]!, true); view.setFloat32(o + 8, positions[p + 2]!, true);
      o += 12;
    }
    o += 2; // attribute byte count
  }
  return out;
}
