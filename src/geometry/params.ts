import { RANGES, type Range } from './constants';

export type GloveMode = 'tube' | 'box';
export type MountType = 'tape' | 'vesa' | 'amps' | 'magnets' | 'ivpole';
export type ProbePresetId = 'custom' | 'butterflyIQ3' | 'vscanAirCL' | 'clariusHD3' | 'philipsLumify';

export type Params = {
  tolerance: number;
  probePreset: ProbePresetId;
  cradleW: number;
  cradleD: number;
  holsterH: number;
  gelH: number;
  gloveMode: GloveMode;
  mount: MountType;
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
  gloveMode: 'tube',
  mount: 'tape',
};

export type ProbePreset = {
  id: ProbePresetId;
  label: string;
  /** Cradle cavity top width / depth in mm. Ignored for 'custom'. */
  cradleW: number;
  cradleD: number;
  verified: boolean;
};

// TODO(measure): every preset below carries the default 62 x 44 placeholder.
// Never enter manufacturer dimensions; measure real devices with calipers first.
export const PROBE_PRESETS: readonly ProbePreset[] = [
  { id: 'custom', label: 'Custom size', cradleW: 62, cradleD: 44, verified: true },
  { id: 'butterflyIQ3', label: 'Butterfly iQ3', cradleW: 62, cradleD: 44, verified: false },
  { id: 'vscanAirCL', label: 'Vscan Air CL', cradleW: 62, cradleD: 44, verified: false },
  { id: 'clariusHD3', label: 'Clarius HD3', cradleW: 62, cradleD: 44, verified: false },
  { id: 'philipsLumify', label: 'Philips Lumify', cradleW: 62, cradleD: 44, verified: false },
];

export const PRESET_HELPER_TEXT = 'Preset sizes are not measured yet. Check yours with calipers';

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
    gloveMode: pickEnum(q.gloveMode, GLOVE_MODES, DEFAULT_PARAMS.gloveMode),
    mount: pickEnum(q.mount, MOUNT_TYPES, DEFAULT_PARAMS.mount),
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
