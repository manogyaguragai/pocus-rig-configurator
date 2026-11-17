import type { BBox, PartId } from '../geometry/types';
import { BED, MAX_PART_SIZE } from '../geometry/constants';
import { PART_META } from '../geometry/types';

/** Lengths: one decimal, always with ` mm`. */
export function formatLength(mm: number): string {
  return `${mm.toFixed(1)} mm`;
}

/** Clearance: two decimals, always with ` mm`. */
export function formatClearance(mm: number): string {
  return `${mm.toFixed(2)} mm`;
}

/** `80.0 × 59.8 × 100.0 mm` from a bounding box (x, y, z extents). */
export function formatBBoxDims(b: BBox): string {
  const d = [0, 1, 2].map((k) => (b.max[k]! - b.min[k]!).toFixed(1));
  return `${d[0]} × ${d[1]} × ${d[2]} mm`;
}

/** Largest print extent per axis across a set of parts, as `80.0 × 60.0 × 100.0 mm`; null when empty. */
export function largestPartDims(boxes: readonly BBox[]): string | null {
  if (boxes.length === 0) return null;
  const m = [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k]! - b.min[k]!)));
  return `${m[0]!.toFixed(1)} × ${m[1]!.toFixed(1)} × ${m[2]!.toFixed(1)} mm`;
}

export function partCountText(n: number): string {
  return `${n} ${n === 1 ? 'part' : 'parts'}`;
}

export type RigStatusInput = {
  fits: boolean;
  partCount: number;
  oversize: { id: PartId; dims: [number, number, number] }[];
};

export type StatusView = {
  warning: boolean;
  /** Main line */
  text: string;
  /** Right-aligned count */
  count: string;
  /** One entry per oversize part */
  details: string[];
};

export function statusView(s: RigStatusInput): StatusView {
  const count = partCountText(s.partCount);
  if (s.fits && s.oversize.length === 0) {
    return { warning: false, text: `Fits a ${BED} mm bed`, count, details: [] };
  }
  const n = s.oversize.length;
  return {
    warning: true,
    text: n === 1 ? `1 part is over ${MAX_PART_SIZE} mm` : `${n} parts are over ${MAX_PART_SIZE} mm`,
    count,
    details: s.oversize.map((o) => `${PART_META[o.id].label}: ${o.dims.map((v) => v.toFixed(1)).join(' × ')} mm`),
  };
}

const PRINT_NOTES: Record<PartId, string> = {
  holster: 'Prints upright, no supports',
  caddy: 'Prints upright, no supports',
  gloveTube: 'Prints upright, no supports',
  gloveBox: 'Prints upright, no supports',
  plate: 'Prints back face down, rail up',
  vclamp: 'Prints plate face down, V up',
  calibMale: 'Prints upright, no supports',
  calibFemaleLo: 'Prints upright, no supports',
  calibFemale: 'Prints upright, no supports',
  calibFemaleHi: 'Prints upright, no supports',
};

export function printNote(id: PartId): string {
  return PRINT_NOTES[id];
}

export type NumberRange = { min: number; max: number; step: number };

/**
 * Turns typed text into a value on the control's grid, clamped to its range.
 * Returns null when the text holds no number (the caller keeps the old value).
 */
export function commitValue(raw: string, r: NumberRange): number | null {
  const cleaned = raw.replace(/mm/gi, '').replace(',', '.').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(r.max, Math.max(r.min, n));
  const snapped = r.min + Math.round((clamped - r.min) / r.step) * r.step;
  return Math.min(r.max, Math.max(r.min, Number(snapped.toFixed(6))));
}
