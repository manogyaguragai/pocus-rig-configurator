import type { BBox, Params, PartId } from '../geometry';
import type { PartMesh } from './protocol';

/*
 * public/default-assembly.bin layout (little endian):
 *   u32 headerBytes | header JSON (utf8, padded with spaces to a multiple of 4) | part blobs
 * Each part blob: Float32 positions then Uint32 indices, in header order.
 * Meshes are in the Blender frame, same as worker results.
 */
export type DefaultMeshHeader = {
  version: 1;
  params: Params;
  parts: { id: PartId; positionFloats: number; indexCount: number; printBbox: BBox; volume: number }[];
};

export function encodeDefaultMesh(params: Params, parts: PartMesh[]): Uint8Array {
  const header: DefaultMeshHeader = {
    version: 1,
    params,
    parts: parts.map((p) => ({
      id: p.id,
      positionFloats: p.positions.length,
      indexCount: p.indices.length,
      printBbox: p.printBbox,
      volume: p.volume,
    })),
  };
  let json = JSON.stringify(header);
  while (new TextEncoder().encode(json).length % 4) json += ' ';
  const h = new TextEncoder().encode(json);
  const body = parts.reduce((n, p) => n + p.positions.byteLength + p.indices.byteLength, 0);
  const out = new Uint8Array(4 + h.length + body);
  new DataView(out.buffer).setUint32(0, h.length, true);
  out.set(h, 4);
  let o = 4 + h.length;
  for (const p of parts) {
    out.set(new Uint8Array(p.positions.buffer, p.positions.byteOffset, p.positions.byteLength), o);
    o += p.positions.byteLength;
    out.set(new Uint8Array(p.indices.buffer, p.indices.byteOffset, p.indices.byteLength), o);
    o += p.indices.byteLength;
  }
  return out;
}

export function decodeDefaultMesh(buf: ArrayBuffer): { params: Params; parts: PartMesh[] } {
  const hl = new DataView(buf).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as DefaultMeshHeader;
  if (header.version !== 1) throw new Error('Unsupported default mesh version');
  let o = 4 + hl;
  const parts = header.parts.map((h): PartMesh => {
    const positions = new Float32Array(buf, o, h.positionFloats);
    o += h.positionFloats * 4;
    const indices = new Uint32Array(buf, o, h.indexCount);
    o += h.indexCount * 4;
    return { id: h.id, positions, indices, printBbox: h.printBbox, volume: h.volume };
  });
  return { params: header.params, parts };
}
