import { activeParts, clampParams, PART_DEPS, type Params, type PartId } from '../geometry';
import type { PartMesh, WorkerLike, WorkerResponse } from './protocol';

export type OnceMeshes = Partial<Record<PartId, PartMesh>>;

export type GeometrySnapshot = {
  /** Meshes of the last applied build (kept until a newer result replaces them). */
  meshes: Readonly<Partial<Record<PartId, PartMesh>>>;
  /** Params the current meshes correspond to; null before the first result. */
  appliedParams: Params | null;
  /** A job is pending (debouncing) or in flight. */
  building: boolean;
  lastMs: number | null;
  error: string | null;
  workerReady: boolean;
  /** Number of jobs posted to the worker (criterion 6 and 7 probes). */
  jobsStarted: number;
};

export type ClientOptions = { debounceMs?: number };

/** Parts to rebuild going from `prev` (last applied, or null) to `next`. Both clamped. */
export function partsToBuild(prev: Params | null, next: Params): PartId[] {
  const active = activeParts(next);
  if (!prev) return active;
  const was = new Set(activeParts(prev));
  return active.filter((id) => !was.has(id) || PART_DEPS[id].some((k) => prev[k] !== next[k]));
}

export class GeometryClient {
  private worker: WorkerLike;
  private debounceMs: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private target: Params | null = null; // latest requested params
  private jobId = 0;
  private inflight: { id: number; params: Params; parts: PartId[] } | null = null;
  private listeners = new Set<() => void>();
  private onceId = 0;
  private once = new Map<number, { resolve: (m: OnceMeshes) => void; reject: (e: Error) => void }>();
  private snap: GeometrySnapshot = {
    meshes: {},
    appliedParams: null,
    building: false,
    lastMs: null,
    error: null,
    workerReady: false,
    jobsStarted: 0,
  };

  constructor(createWorker: () => WorkerLike, opts: ClientOptions = {}) {
    this.debounceMs = opts.debounceMs ?? 200;
    this.worker = createWorker();
    this.worker.onmessage = (ev) => this.onMessage(ev.data);
    this.worker.onerror = (ev) => {
      this.rejectOnce(ev.message ?? 'Worker error');
      this.fail(this.inflight?.id ?? this.jobId, ev.message ?? 'Worker error');
    };
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): GeometrySnapshot => this.snap;

  /**
   * Shows prebuilt meshes (default assembly) before the worker is ready. Without `params` they
   * are not treated as applied, so the first request builds every part. With `params` (the
   * params the meshes were built from) the first request is diffed against them, so a single
   * control change rebuilds only its dependent parts.
   */
  seed(meshes: PartMesh[], params?: Params): void {
    if (this.snap.appliedParams || Object.keys(this.snap.meshes).length) return;
    this.set({
      meshes: Object.fromEntries(meshes.map((m) => [m.id, m])),
      appliedParams: params ? clampParams(params) : null,
    });
  }

  /** Debounced. Params are clamped here; callers may pass anything. */
  request(params: Partial<Params>): void {
    this.target = clampParams(params);
    this.set({ building: true });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  /**
   * One-off build of the given parts with the given params (e.g. calibration pieces). Posts its
   * own request, never touches the snapshot, jobsStarted, the debounce timer or the stale-job
   * logic, so slider changes cannot cancel it and it cannot cancel them.
   */
  buildOnce(params: Partial<Params>, parts: PartId[]): Promise<OnceMeshes> {
    const requestId = ++this.onceId;
    return new Promise((resolve, reject) => {
      this.once.set(requestId, { resolve, reject });
      this.worker.postMessage({ type: 'buildOnce', requestId, params: clampParams(params), parts });
    });
  }

  /** Number of one-off builds started (separate from `jobsStarted`). */
  get onceStarted(): number {
    return this.onceId;
  }

  private rejectOnce(message: string): void {
    for (const p of this.once.values()) p.reject(new Error(message));
    this.once.clear();
  }

  dispose(): void {
    this.rejectOnce('Worker stopped');
    clearTimeout(this.timer);
    this.worker.terminate();
    this.listeners.clear();
  }

  private flush(): void {
    const next = this.target;
    if (!next) return;
    // Always diff against the last APPLIED params: a superseded job's parts are folded in.
    const parts = partsToBuild(this.snap.appliedParams, next);
    const id = ++this.jobId; // also invalidates any in-flight job
    if (parts.length === 0) {
      this.inflight = null;
      this.set({ building: false });
      return;
    }
    this.inflight = { id, params: next, parts };
    this.set({ jobsStarted: this.snap.jobsStarted + 1, error: null });
    this.worker.postMessage({ type: 'build', jobId: id, params: next, parts });
  }

  private onMessage(msg: WorkerResponse): void {
    if (msg.type === 'ready') return this.set({ workerReady: true });
    if (msg.type === 'onceResult' || msg.type === 'onceError') {
      const p = this.once.get(msg.requestId);
      if (!p) return;
      this.once.delete(msg.requestId);
      if (msg.type === 'onceError') p.reject(new Error(msg.message));
      else p.resolve(Object.fromEntries(msg.parts.map((m) => [m.id, m])) as OnceMeshes);
      return;
    }
    if (msg.jobId !== this.jobId || !this.inflight || this.inflight.id !== msg.jobId) return; // stale
    if (msg.type === 'error') return this.fail(msg.jobId, msg.message);
    const { params } = this.inflight;
    const keep = new Set(activeParts(params));
    const meshes: Partial<Record<PartId, PartMesh>> = {};
    // First result replaces everything (drops seeded meshes); later ones keep untouched parts.
    if (this.snap.appliedParams) {
      for (const [k, v] of Object.entries(this.snap.meshes) as [PartId, PartMesh][]) if (keep.has(k)) meshes[k] = v;
    }
    for (const p of msg.parts) meshes[p.id] = p;
    this.inflight = null;
    this.set({ meshes, appliedParams: params, lastMs: msg.ms, error: null, building: false });
  }

  private fail(jobId: number, message: string): void {
    if (jobId !== this.jobId) return;
    this.inflight = null;
    this.set({ error: message, building: false });
  }

  private set(patch: Partial<GeometrySnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of [...this.listeners]) l();
  }
}

/** Real browser worker. Vite bundles the worker and its WASM. */
export function createBrowserWorker(): WorkerLike {
  return new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
}
