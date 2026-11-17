import { zipSync, strToU8 } from 'fflate';
import { BED } from '../geometry/constants';
import type { Params } from '../geometry/params';
import { PART_META, type PartId } from '../geometry/types';
import { meshBBox, type PrintMesh } from './print';
import { tolToken } from './names';

export const SLATE = '#2a3038';
export const TEAL = '#0b8a73';
export const BED_MARGIN = 3;

export type LayoutBox = { id: string; w: number; d: number };
/** (x, y) is the min corner of the footprint. `rotated`: footprint turned 90 degrees about z (w and d swap). */
export type Placement = { id: string; x: number; y: number; rotated: boolean };
export type Layout = { placements: Placement[]; fits: boolean };

type Rect = { x: number; y: number; w: number; d: number };
const same = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.w === b.w && a.d === b.d;

/** MaxRects (best short side fit) into a `bin` x `bin` square. Returns null when something does not fit. */
function maxRects(order: LayoutBox[], bin: number, allowRotate: boolean): Map<string, Rect & { rotated: boolean }> | null {
  let free: Rect[] = [{ x: 0, y: 0, w: bin, d: bin }];
  const out = new Map<string, Rect & { rotated: boolean }>();
  for (const b of order) {
    let best: { r: Rect; rotated: boolean; s1: number; s2: number } | null = null;
    for (const f of free)
      for (const rotated of allowRotate ? [false, true] : [false]) {
        const w = rotated ? b.d : b.w, d = rotated ? b.w : b.d;
        if (w > f.w + 1e-9 || d > f.d + 1e-9) continue;
        const s1 = Math.min(f.w - w, f.d - d), s2 = Math.max(f.w - w, f.d - d);
        if (!best || s1 < best.s1 || (s1 === best.s1 && s2 < best.s2)) best = { r: { x: f.x, y: f.y, w, d }, rotated, s1, s2 };
      }
    if (!best) return null;
    const p = best.r;
    out.set(b.id, { ...p, rotated: best.rotated });
    const next: Rect[] = [];
    for (const f of free) {
      if (p.x >= f.x + f.w || p.x + p.w <= f.x || p.y >= f.y + f.d || p.y + p.d <= f.y) { next.push(f); continue; }
      if (p.x > f.x) next.push({ x: f.x, y: f.y, w: p.x - f.x, d: f.d });
      if (p.x + p.w < f.x + f.w) next.push({ x: p.x + p.w, y: f.y, w: f.x + f.w - (p.x + p.w), d: f.d });
      if (p.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, d: p.y - f.y });
      if (p.y + p.d < f.y + f.d) next.push({ x: f.x, y: p.y + p.d, w: f.w, d: f.y + f.d - (p.y + p.d) });
    }
    free = next.filter((a, i) =>
      !next.some((c, j) => j !== i && c.x <= a.x && c.y <= a.y && c.x + c.w >= a.x + a.w && c.y + c.d >= a.y + a.d && !(same(a, c) && i < j)));
  }
  return out;
}

/**
 * Pure rectangle packer (MaxRects). Every footprint ends up inside margin..bed-margin with at
 * least `margin` between footprints. Tries several orderings without rotation first, then with
 * 90 degree turns about z (a turn about z does not change print orientation). `fits` is false
 * when nothing worked; placements are then a row-by-row fallback that overflows the bed.
 * Result order follows the input order.
 */
export function layoutOnBed(boxes: readonly LayoutBox[], margin = BED_MARGIN, bed = BED): Layout {
  const inflated = boxes.map((b) => ({ id: b.id, w: b.w + margin, d: b.d + margin }));
  const orders: ((a: LayoutBox, b: LayoutBox) => number)[] = [
    (a, b) => b.w * b.d - a.w * a.d,
    (a, b) => Math.max(b.w, b.d) - Math.max(a.w, a.d),
    (a, b) => b.d - a.d || b.w - a.w,
    (a, b) => b.w - a.w || b.d - a.d,
  ];
  for (const allowRotate of [false, true])
    for (const cmp of orders) {
      const r = maxRects([...inflated].sort(cmp), bed - margin, allowRotate);
      if (r)
        return {
          fits: true,
          placements: boxes.map((b) => {
            const p = r.get(b.id)!;
            return { id: b.id, x: p.x + margin, y: p.y + margin, rotated: p.rotated };
          }),
        };
    }
  let x = margin;
  return {
    fits: false,
    placements: boxes.map((b) => {
      const p = { id: b.id, x, y: margin, rotated: false };
      x += b.w + margin;
      return p;
    }),
  };
}

const f = (v: number): string => String(parseFloat(v.toFixed(4)) + 0);

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
  '</Types>';

const RELS =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rel0" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
  '</Relationships>';

/** pindex into the single <basematerials> resource: 0 slate, 1 teal. */
export const materialIndex = (id: PartId): 0 | 1 => (PART_META[id].material === 'slate' ? 0 : 1);

export type ThreeMfOptions = { title?: string; margin?: number };

/**
 * One .3mf (zip) with every part. Input meshes are print-oriented and centred; this lays them
 * out on the 256 mm bed (bbox min corner placed by `layoutOnBed`, z kept) and writes one
 * <object> per part with indexed, deduplicated vertices. One <basematerials> resource holds
 * the two colours; each object picks one with pid/pindex. Throws if the parts cannot fit.
 */
export function build3mf(parts: readonly PrintMesh[], params: Pick<Params, 'tolerance'>, opts: ThreeMfOptions = {}): Uint8Array {
  const boxes = parts.map((p) => {
    const b = meshBBox(p);
    return { id: p.id as string, w: b.max[0] - b.min[0], d: b.max[1] - b.min[1], b };
  });
  const layout = layoutOnBed(boxes, opts.margin ?? BED_MARGIN);
  if (!layout.fits) throw new Error(`These parts do not fit on a ${BED} mm bed together`);

  const objects: string[] = [];
  const items: string[] = [];
  parts.forEach((p, i) => {
    const bx = boxes[i]!;
    const pl = layout.placements[i]!;
    // A rotated footprint is turned 90 degrees about z: (x, y) -> (-y, x).
    const dx = pl.rotated ? pl.x + bx.b.max[1] : pl.x - bx.b.min[0];
    const dy = pl.rotated ? pl.y - bx.b.min[0] : pl.y - bx.b.min[1];
    const index = new Map<string, number>();
    const verts: string[] = [];
    const remap = new Uint32Array(p.positions.length / 3);
    for (let v = 0; v < remap.length; v++) {
      const px = p.positions[v * 3]!, py = p.positions[v * 3 + 1]!;
      const x = f((pl.rotated ? -py : px) + dx), y = f((pl.rotated ? px : py) + dy), z = f(p.positions[v * 3 + 2]!);
      const key = `${x} ${y} ${z}`;
      let id = index.get(key);
      if (id === undefined) {
        id = index.size;
        index.set(key, id);
        verts.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
      }
      remap[v] = id;
    }
    const tris: string[] = [];
    for (let t = 0; t < p.indices.length; t += 3)
      tris.push(`<triangle v1="${remap[p.indices[t]!]}" v2="${remap[p.indices[t + 1]!]}" v3="${remap[p.indices[t + 2]!]}"/>`);
    const oid = i + 2; // 1 is the material resource
    objects.push(
      `<object id="${oid}" name="${xmlEsc(PART_META[p.id].label)}" type="model" pid="1" pindex="${materialIndex(p.id)}">` +
        `<mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`,
    );
    items.push(`<item objectid="${oid}"/>`);
  });

  const title = xmlEsc(opts.title ?? `POCUS Rig, clearance ${tolToken(params.tolerance)}`);
  const model =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
    `<metadata name="Title">${title}</metadata>` +
    '<resources>' +
    `<basematerials id="1"><base name="Slate" displaycolor="${SLATE}"/><base name="Teal" displaycolor="${TEAL}"/></basematerials>` +
    objects.join('') +
    '</resources>' +
    `<build>${items.join('')}</build>` +
    '</model>';

  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELS),
    '3D/3dmodel.model': strToU8(model),
  });
}
