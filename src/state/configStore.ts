import { create } from 'zustand'; // zustand: already the store library for the geometry and view stores
import { clampParams, DEFAULT_PARAMS, type Params } from '../geometry';

type ConfigState = {
  params: Params;
  setParam: <K extends keyof Params>(key: K, value: Params[K]) => void;
  setParams: (p: Partial<Params>) => void;
  reset: () => void;
};

const same = (a: Params, b: Params) => (Object.keys(a) as (keyof Params)[]).every((k) => a[k] === b[k]);

export const useConfigStore = create<ConfigState>()((set) => {
  // Every write is clamped; a write that changes nothing keeps the old reference (no rebuild).
  const apply = (patch: Partial<Params>) =>
    set((s) => {
      const next = clampParams({ ...s.params, ...patch });
      return same(next, s.params) ? s : { params: next };
    });
  return {
    params: { ...DEFAULT_PARAMS },
    setParam: (key, value) => apply({ [key]: value } as Partial<Params>),
    setParams: (p) => apply(p),
    reset: () => apply({ ...DEFAULT_PARAMS }),
  };
});
