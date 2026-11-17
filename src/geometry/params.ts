import { PROBE_CLEARANCE, RANGES, type Range } from './constants';

export type GloveMode = 'tube' | 'box';
export type MountType = 'tape' | 'vesa' | 'amps' | 'magnets' | 'ivpole';
export type ProbePresetId = 'custom' | 'butterflyIQ3' | 'vscanAirCL' | 'clariusHD3';

export type Params = {
  tolerance: number;
  probePreset: ProbePresetId;
  cradleW: number;
  cradleD: number;
  holsterH: number;
  gelH: number;
  gelW: number;
  gloveMode: GloveMode;
  gloveBoxW: number;
  gloveBoxH: number;
  tubeD: number;
  tubeH: number;
  mount: MountType;
  plateW: number;
  plateH: number;
};

export const GLOVE_MODES: readonly GloveMode[] = ['tube', 'box'];
export const MOUNT_TYPES: readonly MountType[] = ['tape', 'vesa', 'amps', 'magnets', 'ivpole'];

export const DEFAULT_PARAMS: Readonly<Params> = {
  tolerance: RANGES.tolerance.default,
  probePreset: 'custom',
  cradleW: RANGES.cradleW.default,
  cradleD: RANGES.cradleD.default,
  holsterH: RANGES.holsterH.default,
  gelH: RANGES.gelH.default,
  gelW: RANGES.gelW.default,
  gloveMode: 'tube',
  gloveBoxW: RANGES.gloveBoxW.default,
  gloveBoxH: RANGES.gloveBoxH.default,
  tubeD: RANGES.tubeD.default,
  tubeH: RANGES.tubeH.default,
  mount: 'tape',
  plateW: RANGES.plateW.default,
  plateH: RANGES.plateH.default,
};

export type ProbePreset = {
  id: ProbePresetId;
  label: string;
  /** Published widest width / thickness of the probe body in mm (documentation; undefined for custom). */
  probeW?: number;
  probeD?: number;
  /** Short source description. */
  sourceNote: string;
  /** Cradle cavity top width / depth in mm. Ignored for 'custom'. Derived from probeW/probeD when published. */
  cradleW: number;
  cradleD: number;
  /** True only when caliper-measured. Nothing is yet. */
  verified: boolean;
};

const fromPublished = (probeW: number, probeD: number) => ({
  probeW,
  probeD,
  cradleW: clampToRange(probeW + PROBE_CLEARANCE, RANGES.cradleW),
  cradleD: clampToRange(probeD + PROBE_CLEARANCE, RANGES.cradleD),
});

// TODO(measure): none of these are caliper-measured (verified stays false). Published sizes plus clearance are a
// starting point only.
export const PROBE_PRESETS: readonly ProbePreset[] = [
  { id: 'custom', label: 'Custom size', sourceNote: 'Set with the sliders', cradleW: 62, cradleD: 44, verified: true },
  {
    id: 'butterflyIQ3', label: 'Butterfly iQ3', verified: false,
    sourceNote: 'Butterfly Network specifications, 152 x 52 x 37 mm', ...fromPublished(52, 37),
  },
  {
    id: 'vscanAirCL', label: 'Vscan Air CL', verified: false,
    sourceNote: 'GE Vscan Air specifications, maximum 131 x 64 x 31 mm', ...fromPublished(64, 31),
  },
  {
    // TODO(measure): re-check; only the C3 and L7 figures were confirmed, the other HD3 models are assumed to share the section.
    id: 'clariusHD3', label: 'Clarius HD3', verified: false,
    sourceNote: 'Clarius scanner dimensions table, 76 x 32 mm section', ...fromPublished(76, 32),
  },
];

const PRESET_IDS = PROBE_PRESETS.map((p) => p.id);

/** Round to the step grid anchored at min, clamp to [min, max], strip float noise. */
export function clampToRange(v: unknown, r: Range): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : r.default;
  const snapped = r.min + Math.round((n - r.min) / r.step) * r.step;
  const clamped = Math.min(r.max, Math.max(r.min, snapped));
  return Number(clamped.toFixed(4));
}

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** Total: any input (URL hash, localStorage, partial object) becomes a valid Params. */
export function clampParams(p: Partial<Params> | Params): Params {
  const q = (p ?? {}) as Partial<Record<keyof Params, unknown>>;
  return {
    tolerance: clampToRange(q.tolerance, RANGES.tolerance),
    probePreset: pickEnum(q.probePreset, PRESET_IDS, DEFAULT_PARAMS.probePreset),
    cradleW: clampToRange(q.cradleW, RANGES.cradleW),
    cradleD: clampToRange(q.cradleD, RANGES.cradleD),
    holsterH: clampToRange(q.holsterH, RANGES.holsterH),
    gelH: clampToRange(q.gelH, RANGES.gelH),
    gelW: clampToRange(q.gelW, RANGES.gelW),
    gloveMode: pickEnum(q.gloveMode, GLOVE_MODES, DEFAULT_PARAMS.gloveMode),
    gloveBoxW: clampToRange(q.gloveBoxW, RANGES.gloveBoxW),
    gloveBoxH: clampToRange(q.gloveBoxH, RANGES.gloveBoxH),
    tubeD: clampToRange(q.tubeD, RANGES.tubeD),
    tubeH: clampToRange(q.tubeH, RANGES.tubeH),
    mount: pickEnum(q.mount, MOUNT_TYPES, DEFAULT_PARAMS.mount),
    plateW: clampToRange(q.plateW, RANGES.plateW),
    plateH: clampToRange(q.plateH, RANGES.plateH),
  };
}

export type ResolvedProbe = { cradleW: number; cradleD: number; verified: boolean; preset: ProbePresetId };

/** Effective cradle size: presets fill W/D, 'custom' uses the sliders. Assumes clamped input. */
export function resolveProbe(p: Params): ResolvedProbe {
  const preset = PROBE_PRESETS.find((x) => x.id === p.probePreset);
  if (!preset || preset.id === 'custom') {
    return { cradleW: p.cradleW, cradleD: p.cradleD, verified: true, preset: 'custom' };
  }
  return {
    cradleW: clampToRange(preset.cradleW, RANGES.cradleW),
    cradleD: clampToRange(preset.cradleD, RANGES.cradleD),
    verified: preset.verified,
    preset: preset.id,
  };
}
