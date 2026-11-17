import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clampParams, DEFAULT_PARAMS, GLOVE_MODES, MOUNT_TYPES, PROBE_PRESETS, RANGES, type Params } from '../geometry';
import { decodeHash, encodeHash, loadInitialParams, saveParams, STORAGE_KEY, type StorageLike } from './persistence';
import { useConfigStore } from './configStore';
import { startApp, type AppEnv } from './app';
import { useViewStore } from '../store/viewStore';
import { rigStatus } from './selectors';

const D = { ...DEFAULT_PARAMS };
const mem = (init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => ({
  data: init,
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = v; },
});
const spyConsole = () => (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
const rnd = (r: { min: number; max: number; step: number }) => r.min + Math.floor(Math.random() * (Math.round((r.max - r.min) / r.step) + 1)) * r.step;
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;

afterEach(() => vi.restoreAllMocks());

describe('hash', () => {
  it('default format and round trip', () => {
    expect(encodeHash(D)).toBe('t=0.25&p=custom&w=62&d=44&h=100&g=125&gw=55&gl=tube&bw=132&bh=73&td=50&th=110&m=tape&pw=124&ph=170&v=1');
    expect(clampParams(decodeHash('#' + encodeHash(D))!)).toEqual(D);
  });
  it('round trips random valid params', () => {
    for (let i = 0; i < 300; i++) {
      const p = clampParams({
        tolerance: rnd(RANGES.tolerance), cradleW: rnd(RANGES.cradleW), cradleD: rnd(RANGES.cradleD),
        holsterH: rnd(RANGES.holsterH), gelH: rnd(RANGES.gelH), gelW: rnd(RANGES.gelW),
        gloveBoxW: rnd(RANGES.gloveBoxW), gloveBoxH: rnd(RANGES.gloveBoxH), tubeD: rnd(RANGES.tubeD), tubeH: rnd(RANGES.tubeH),
        plateW: rnd(RANGES.plateW), plateH: rnd(RANGES.plateH),
        probePreset: pick(PROBE_PRESETS).id, gloveMode: pick(GLOVE_MODES), mount: pick(MOUNT_TYPES),
      });
      expect(decodeHash(encodeHash(p))).toEqual(p);
    }
  });
  it('every preset round trips through the hash', () => {
    for (const x of PROBE_PRESETS) {
      const p = clampParams({ ...D, probePreset: x.id });
      expect(decodeHash(encodeHash(p))?.probePreset).toBe(x.id);
      expect(clampParams(decodeHash(encodeHash(p))!)).toEqual(p);
    }
  });
  it('a removed preset id in an old hash falls back to Custom size', () => {
    const p = clampParams(decodeHash('#t=0.25&p=removedPreset&w=62&d=44&h=100&g=125&gl=tube&m=tape&v=1')!);
    expect(p.probePreset).toBe('custom');
  });
  it('clamps out of range, drops garbage, never throws', () => {
    expect(decodeHash('t=9&w=-4&gl=box&m=nope&v=1')).toEqual({ tolerance: 0.4, cradleW: 30, gloveMode: 'box' });
    expect(decodeHash('w=abc&h=&v=1')).toBeNull();
    for (const bad of ['', '#', 'garbage', '%%%&&==', 't=0.25', 't=0.25&v=2', 't=0.25&v=', '&&&', 'v=1', '=1&v=1'])
      expect(decodeHash(bad)).toBeNull();
    expect(() => decodeHash(undefined as unknown as string)).not.toThrow();
    // truncated: first fields survive, last (version) lost -> rejected
    expect(decodeHash(encodeHash(D).slice(0, -4))).toBeNull();
  });
});

describe('load order and storage', () => {
  const saved = { ...D, gelH: 150 };
  it('hash beats autosave beats defaults', () => {
    const s = mem();
    expect(loadInitialParams('', s)).toEqual(D);
    saveParams(saved, s);
    expect(loadInitialParams('', s)).toEqual(saved);
    expect(loadInitialParams('#' + encodeHash({ ...D, gelH: 90 }), s).gelH).toBe(90);
    expect(loadInitialParams('#junk', s)).toEqual(saved);
  });
  it('corrupt / old / wrong shape -> defaults, no console output', () => {
    const spies = spyConsole();
    for (const v of ['{not json', 'null', '"x"', '{"v":0,"params":{"gelH":150}}', '{"v":2,"params":{}}', '{"v":1}', '{"v":1,"params":5}'])
      expect(loadInitialParams('', mem({ [STORAGE_KEY]: v }))).toEqual(D);
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  });
  it('throwing storage still works', () => {
    const spies = spyConsole();
    const bad: StorageLike = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(loadInitialParams('', bad)).toEqual(D);
    expect(() => saveParams(D, bad)).not.toThrow();
    expect(loadInitialParams('', null)).toEqual(D);
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  });
});

describe('configStore', () => {
  beforeEach(() => useConfigStore.getState().reset());
  it('setParam clamps', () => {
    const s = useConfigStore.getState;
    s().setParam('gelH', 9999);
    expect(s().params.gelH).toBe(RANGES.gelH.max);
    s().setParam('tolerance', 0.31);
    expect(s().params.tolerance).toBe(0.3);
    s().setParams({ cradleW: -1, mount: 'ivpole' });
    expect(s().params.cradleW).toBe(30);
    expect(s().params.mount).toBe('ivpole');
    s().reset();
    expect(s().params).toEqual(D);
  });
  it('no-op write keeps reference', () => {
    const before = useConfigStore.getState().params;
    useConfigStore.getState().setParam('gelH', 125);
    expect(useConfigStore.getState().params).toBe(before);
  });
});

describe('selectors', () => {
  const m = (dims: [number, number, number]) => ({ id: 'x', positions: new Float32Array(), indices: new Uint32Array(), volume: 0, printBbox: { min: [0, 0, 0], max: dims } }) as never;
  it('oversize detection', () => {
    const r = rigStatus({ plate: m([100, 100, 5]), holster: m([251, 50, 50]) });
    expect(r.fits).toBe(false);
    expect(r.partCount).toBe(2);
    expect(r.oversize).toEqual([{ id: 'holster', dims: [251, 50, 50] }]);
    expect(rigStatus({ plate: m([250, 250, 250]) }).fits).toBe(true);
  });
});

describe('startApp', () => {
  beforeEach(() => { vi.useFakeTimers(); useConfigStore.getState().reset(); });
  afterEach(() => vi.useRealTimers());

  const setup = (hash = '', storage = mem()) => {
    let h = hash;
    const listeners = new Set<() => void>();
    const replaced: string[] = [];
    const leave = new Set<() => void>();
    const env: AppEnv = {
      onLeave: (fn) => { leave.add(fn); return () => leave.delete(fn); },
      getHash: () => h,
      replaceHash: (x) => { replaced.push(x); h = '#' + x; },
      onHashChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      storage,
    };
    const client = {
      request: vi.fn(), seed: vi.fn(), dispose: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      getSnapshot: () => ({ meshes: {}, appliedParams: null, building: false, lastMs: null, error: null, workerReady: false, jobsStarted: 0 }),
    };
    const loadMesh = vi.fn(async () => ({ params: { ...D } as Params, parts: [] }));
    const dispose = startApp({ env, createClient: () => client as never, loadMesh, saveDebounceMs: 400 });
    return { client, loadMesh, dispose, replaced, storage, leave: () => leave.forEach((f) => f()), fire: (nh: string) => { h = nh; listeners.forEach((f) => f()); } };
  };

  it('defaults: seeds the mesh, view changes never request, config change requests once after debounce', async () => {
    const a = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(a.client.seed).toHaveBeenCalledTimes(1);
    expect(a.client.request).not.toHaveBeenCalled();
    for (let i = 0; i < 20; i++) { useViewStore.getState().toggleXray(); useViewStore.getState().toggleViewMode(); }
    await vi.advanceTimersByTimeAsync(2000);
    expect(a.client.request).not.toHaveBeenCalled();
    expect(a.replaced).toEqual([]);
    useConfigStore.getState().setParam('gelH', 140);
    expect(a.client.request).toHaveBeenCalledTimes(1);
    useConfigStore.getState().setParam('gelH', 141);
    useConfigStore.getState().setParam('gelH', 142);
    await vi.advanceTimersByTimeAsync(500);
    expect(a.replaced).toEqual([encodeHash({ ...D, gelH: 142 })]); // one history write after the burst
    expect(JSON.parse(a.storage.data[STORAGE_KEY]!).params.gelH).toBe(142);
    a.dispose();
    useConfigStore.getState().setParam('gelH', 100);
    expect(a.client.request).toHaveBeenCalledTimes(3);
  });

  it('flushes a pending write synchronously when the page is hidden or unloaded', async () => {
    const a = setup();
    await vi.advanceTimersByTimeAsync(0);
    useConfigStore.getState().setParam('gelH', 150);
    expect(a.replaced).toEqual([]); // still debounced
    a.leave();
    expect(a.replaced).toEqual([encodeHash({ ...D, gelH: 150 })]);
    expect(JSON.parse(a.storage.data[STORAGE_KEY]!).params.gelH).toBe(150);
    a.leave(); // nothing pending: no duplicate write
    await vi.advanceTimersByTimeAsync(1000);
    expect(a.replaced).toHaveLength(1);
    // reset to defaults, then leave before the debounce fires
    useConfigStore.getState().reset();
    a.leave();
    expect(JSON.parse(a.storage.data[STORAGE_KEY]!).params.gelH).toBe(D.gelH);
    expect(a.replaced[1]).toBe(encodeHash(D));
    a.dispose();
  });

  it('non-default initial params request the real build and skip the default mesh', async () => {
    const a = setup('#' + encodeHash({ ...D, mount: 'ivpole' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(a.loadMesh).not.toHaveBeenCalled();
    expect(a.client.request).toHaveBeenCalledTimes(1);
    expect(useConfigStore.getState().params.mount).toBe('ivpole');
    a.dispose();
  });

  it('hashchange updates config', () => {
    const a = setup();
    a.fire('#' + encodeHash({ ...D, holsterH: 120 }));
    expect(useConfigStore.getState().params.holsterH).toBe(120);
    expect(a.client.request).toHaveBeenCalledTimes(1);
    a.fire('#garbage');
    expect(useConfigStore.getState().params.holsterH).toBe(120);
    a.dispose();
  });
});
