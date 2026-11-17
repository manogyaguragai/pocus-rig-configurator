import { clampParams, clampToRange, DEFAULT_PARAMS, GLOVE_MODES, MOUNT_TYPES, PROBE_PRESETS, RANGES, type Params } from '../geometry';

export const HASH_VERSION = 1;
export const STORAGE_KEY = 'pocus-rig-config';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const NUM_KEYS = { t: 'tolerance', w: 'cradleW', d: 'cradleD', h: 'holsterH', g: 'gelH' } as const;
const ENUMS = {
  p: { key: 'probePreset', allowed: PROBE_PRESETS.map((x) => x.id) as readonly string[] },
  gl: { key: 'gloveMode', allowed: GLOVE_MODES as readonly string[] },
  m: { key: 'mount', allowed: MOUNT_TYPES as readonly string[] },
} as const;

/** e.g. `t=0.25&p=custom&w=62&d=44&h=100&g=125&gl=tube&m=tape&v=1` (no leading #). */
export function encodeHash(params: Params): string {
  const q = clampParams(params);
  return [
    `t=${q.tolerance}`, `p=${q.probePreset}`, `w=${q.cradleW}`, `d=${q.cradleD}`,
    `h=${q.holsterH}`, `g=${q.gelH}`, `gl=${q.gloveMode}`, `m=${q.mount}`, `v=${HASH_VERSION}`,
  ].join('&');
}

/** Valid fields only (numbers clamped, bad values dropped). Null when unusable or wrong version. Never throws. */
export function decodeHash(hash: string): Partial<Params> | null {
  try {
    const raw = String(hash ?? '').replace(/^#/, '');
    if (!raw) return null;
    const map = new Map<string, string>();
    for (const pair of raw.split('&')) {
      const i = pair.indexOf('=');
      if (i > 0) map.set(pair.slice(0, i), pair.slice(i + 1));
    }
    if (map.get('v') !== String(HASH_VERSION)) return null;
    const out: Record<string, unknown> = {};
    for (const [k, name] of Object.entries(NUM_KEYS)) {
      const s = map.get(k);
      if (s === undefined || s.trim() === '') continue;
      const n = Number(s);
      if (Number.isFinite(n)) out[name] = clampToRange(n, RANGES[name]);
    }
    for (const [k, e] of Object.entries(ENUMS)) {
      const s = map.get(k);
      if (s !== undefined && e.allowed.includes(s)) out[e.key] = s;
    }
    return Object.keys(out).length ? (out as Partial<Params>) : null;
  } catch {
    return null;
  }
}

function loadSaved(storage: StorageLike | null | undefined): Partial<Params> | null {
  try {
    const txt = storage?.getItem(STORAGE_KEY);
    if (!txt) return null;
    const o = JSON.parse(txt) as { v?: unknown; params?: unknown };
    if (!o || o.v !== HASH_VERSION || !o.params || typeof o.params !== 'object') return null;
    return decodeHash(encodeHash(clampParams(o.params as Partial<Params>)));
  } catch {
    return null;
  }
}

/** Load order: URL hash, then localStorage autosave, then defaults. Silent on any failure. */
export function loadInitialParams(hash: string, storage: StorageLike | null | undefined): Params {
  const p = decodeHash(hash) ?? loadSaved(storage);
  return p ? clampParams(p) : { ...DEFAULT_PARAMS };
}

export function saveParams(params: Params, storage: StorageLike | null | undefined): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ v: HASH_VERSION, params: clampParams(params) }));
  } catch {
    /* quota, private mode, blocked storage: autosave is best effort */
  }
}
