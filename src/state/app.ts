import { DEFAULT_PARAMS, type Params } from '../geometry';
import { createBrowserWorker, GeometryClient } from '../worker/client';
import { loadDefaultMesh } from '../worker/defaultMesh';
import { connectGeometryClient } from '../store/geometryStore';
import { useConfigStore } from './configStore';
import { decodeHash, encodeHash, loadInitialParams, saveParams, type StorageLike } from './persistence';

export type AppEnv = {
  getHash(): string;
  /** Replaces the current history entry's hash (never pushes). */
  replaceHash(hash: string): void;
  onHashChange(fn: () => void): () => void;
  storage: StorageLike | null;
  /** Calls `fn` when the page is being hidden or unloaded (pagehide, hidden visibility, beforeunload). Optional. */
  onLeave?(fn: () => void): () => void;
};

export type AppDeps = {
  env: AppEnv;
  createClient: () => GeometryClient;
  loadMesh: typeof loadDefaultMesh;
  saveDebounceMs: number;
};

function browserEnv(): AppEnv {
  let storage: StorageLike | null = null;
  try {
    storage = window.localStorage;
  } catch {
    /* blocked */
  }
  return {
    getHash: () => window.location.hash,
    replaceHash: (h) => window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${h}`),
    onHashChange: (fn) => {
      window.addEventListener('hashchange', fn);
      return () => window.removeEventListener('hashchange', fn);
    },
    storage,
    onLeave: (fn) => {
      const onVis = () => { if (document.visibilityState === 'hidden') fn(); };
      window.addEventListener('pagehide', fn);
      window.addEventListener('beforeunload', fn);
      document.addEventListener('visibilitychange', onVis);
      return () => {
        window.removeEventListener('pagehide', fn);
        window.removeEventListener('beforeunload', fn);
        document.removeEventListener('visibilitychange', onVis);
      };
    },
  };
}

let activeClient: GeometryClient | null = null;
/** The client created by the running startApp (null before start / after dispose). Used by exports. */
export const getGeometryClient = (): GeometryClient | null => activeClient;

const isDefault = (p: Params) => (Object.keys(DEFAULT_PARAMS) as (keyof Params)[]).every((k) => p[k] === DEFAULT_PARAMS[k]);

/** Wires config -> geometry client -> geometry store, plus URL hash and autosave. Returns dispose. */
export function startApp(deps: Partial<AppDeps> = {}): () => void {
  const env = deps.env ?? browserEnv();
  const createClient = deps.createClient ?? (() => new GeometryClient(createBrowserWorker));
  const loadMesh = deps.loadMesh ?? loadDefaultMesh;
  const saveDebounceMs = deps.saveDebounceMs ?? 400;

  const initial = loadInitialParams(env.getHash(), env.storage);
  const cfg = useConfigStore;
  cfg.setState({ params: initial });

  const client = createClient();
  activeClient = client;
  const disconnect = connectGeometryClient(client);
  let disposed = false;

  if (isDefault(initial)) {
    // The prebuilt mesh is the default assembly; seeding with its params keeps the first edit incremental.
    loadMesh().then(
      (d) => { if (!disposed) client.seed(d.parts, d.params); },
      () => {},
    );
  } else {
    client.request(initial);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  const persist = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!dirty) return;
    dirty = false;
    const p = cfg.getState().params;
    saveParams(p, env.storage);
    const h = encodeHash(p);
    if (env.getHash().replace(/^#/, '') !== h) {
      try { env.replaceHash(h); } catch { /* ignore */ }
    }
  };

  const offConfig = cfg.subscribe((s, prev) => {
    if (s.params === prev.params) return;
    client.request(s.params);
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(persist, saveDebounceMs);
  });

  const offHash = env.onHashChange(() => {
    const p = decodeHash(env.getHash());
    if (p) cfg.getState().setParams({ ...DEFAULT_PARAMS, ...p });
  });

  // Flush a pending write synchronously when the page goes away, so a fast reload or tab close keeps the last change.
  const offLeave = env.onLeave?.(persist) ?? (() => {});

  return () => {
    disposed = true;
    offLeave();
    offHash();
    offConfig();
    clearTimeout(timer);
    persist();
    disconnect();
    client.dispose();
    if (activeClient === client) activeClient = null;
  };
}
