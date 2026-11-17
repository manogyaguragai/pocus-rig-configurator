import { describe, expect, it } from 'vitest';
import { Worker as NodeWorker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PARAMS, type Params, type PartId } from '../../geometry';
import { GeometryClient, partsToBuild } from '../client';
import { runBuildJob } from '../buildJob';
import { decodeDefaultMesh } from '../defaultMeshFormat';
import type { BuildRequest, WorkerLike } from '../protocol';
import { readFileSync } from 'node:fs';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** In-process worker running real builds, with controllable latency. */
class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  jobs: BuildRequest[] = [];
  latency = 0;
  /** per-job hold: result is delivered only when released (resolves when called). */
  gate: Promise<void> | null = null;
  postMessage(req: BuildRequest) {
    this.jobs.push(req);
    const gate = this.gate;
    void (async () => {
      const { result } = await runBuildJob(req);
      await sleep(this.latency);
      if (gate) await gate;
      this.onmessage?.({ data: result });
    })();
  }
  terminate() {}
}

function setup(debounceMs = 30) {
  const w = new FakeWorker();
  const c = new GeometryClient(() => w, { debounceMs });
  return { w, c };
}
const P = (o: Partial<Params> = {}): Params => ({ ...DEFAULT_PARAMS, ...o });
async function until(_c: GeometryClient, pred: () => boolean, ms = 30000) {
  const t = Date.now();
  while (!pred()) {
    if (Date.now() - t > ms) throw new Error('timeout');
    await sleep(10);
  }
}
const settled = (c: GeometryClient) => until(c, () => !c.getSnapshot().building);

describe('partsToBuild (dependency-scoped, SPEC 5)', () => {
  const d = P();
  const sorted = (a: PartId[]) => [...a].sort();
  it('first request builds everything active', () => {
    expect(sorted(partsToBuild(null, d))).toEqual(sorted(['plate', 'holster', 'caddy', 'gloveTube']));
  });
  it('gel height -> caddy only', () => expect(partsToBuild(d, P({ gelH: d.gelH + 2 }))).toEqual(['caddy']));
  it('tolerance -> every slot part', () =>
    expect(sorted(partsToBuild(d, P({ tolerance: d.tolerance + 0.05 })))).toEqual(sorted(['holster', 'caddy', 'gloveTube'])));
  it('mount tape -> vesa rebuilds plate only', () => expect(partsToBuild(d, P({ mount: 'vesa' }))).toEqual(['plate']));
  it('mount -> ivpole adds vclamp', () =>
    expect(sorted(partsToBuild(d, P({ mount: 'ivpole' })))).toEqual(['plate', 'vclamp']));
  it('mount ivpole -> tape rebuilds plate (vclamp dropped)', () =>
    expect(partsToBuild(P({ mount: 'ivpole' }), P({ mount: 'tape' }))).toEqual(['plate']));
  it('cradleW / cradleD -> holster, caddy, glove', () => {
    for (const k of ['cradleW', 'cradleD'] as const)
      expect(sorted(partsToBuild(d, P({ [k]: d[k] + 2 })))).toEqual(sorted(['holster', 'caddy', 'gloveTube']));
  });
  it('holsterH -> holster only', () => expect(partsToBuild(d, P({ holsterH: d.holsterH + 2 }))).toEqual(['holster']));
  it('glove mode switch builds the new glove part only', () =>
    expect(partsToBuild(d, P({ gloveMode: 'box' }))).toEqual(['gloveBox']));
});

describe('GeometryClient', () => {
  it('seed with params: first change rebuilds only the dependent part', async () => {
    const { w, c } = setup(20);
    const def = decodeDefaultMesh(readFileSync(fileURLToPath(new URL('../../../public/default-assembly.bin', import.meta.url))).buffer as ArrayBuffer);
    c.seed(def.parts, def.params);
    c.request(P({ gelH: 130 }));
    await settled(c);
    expect(w.jobs.map((j) => j.parts)).toEqual([['caddy']]);
    expect(Object.keys(c.getSnapshot().meshes).sort()).toEqual(['caddy', 'gloveTube', 'holster', 'plate']);
  });
  it('(a) 20 rapid requests start one job and apply only the final result', async () => {
    const { w, c } = setup(200);
    c.request(DEFAULT_PARAMS);
    await settled(c);
    const base = c.getSnapshot().jobsStarted;
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      c.request(P({ gelH: 100 + i }));
      await sleep(40);
    }
    expect(Date.now() - t0).toBeLessThan(1500);
    await settled(c);
    const s = c.getSnapshot();
    expect(s.jobsStarted - base).toBe(1);
    expect(w.jobs.at(-1)!.params.gelH).toBe(119);
    expect(w.jobs.at(-1)!.parts).toEqual(['caddy']);
    expect(s.appliedParams!.gelH).toBe(119);
  });

  it('(b) applied snapshot rebuilds only scoped parts; others keep identity', async () => {
    const { w, c } = setup();
    c.request(DEFAULT_PARAMS);
    await settled(c);
    const before = c.getSnapshot().meshes;
    c.request(P({ gelH: DEFAULT_PARAMS.gelH + 2 }));
    await settled(c);
    expect(w.jobs.at(-1)!.parts).toEqual(['caddy']);
    const after = c.getSnapshot().meshes;
    expect(after.caddy).not.toBe(before.caddy);
    expect(after.holster).toBe(before.holster);
    expect(after.plate).toBe(before.plate);
    // glove switch: new part appears, old one dropped
    c.request(P({ gelH: DEFAULT_PARAMS.gelH + 2, gloveMode: 'box' }));
    await settled(c);
    expect(Object.keys(c.getSnapshot().meshes).sort()).toEqual(['caddy', 'gloveBox', 'holster', 'plate']);
    c.request(P({ gelH: DEFAULT_PARAMS.gelH + 2, gloveMode: 'box', mount: 'ivpole' }));
    await settled(c);
    expect(c.getSnapshot().meshes.vclamp).toBeDefined();
  });

  it('(c) stale result is ignored and a superseding job folds in earlier changes', async () => {
    const { w, c } = setup(10);
    c.request(DEFAULT_PARAMS);
    await settled(c);
    let release!: () => void;
    w.gate = new Promise((r) => (release = r));
    c.request(P({ tolerance: 0.35 })); // job A (held in flight)
    await until(c, () => w.jobs.length === 2);
    w.gate = null;
    c.request(P({ gelH: 140 })); // job B supersedes A; tolerance reverted
    await until(c, () => w.jobs.length === 3);
    // B's parts are relative to the APPLIED params (default tolerance): caddy only
    expect(w.jobs[2]!.parts).toEqual(['caddy']);
    await settled(c);
    const applied = c.getSnapshot().appliedParams!;
    release(); // A's late result arrives
    await sleep(50);
    expect(c.getSnapshot().appliedParams).toBe(applied);
    expect(c.getSnapshot().appliedParams!.tolerance).toBe(DEFAULT_PARAMS.tolerance);

    // union: change tolerance (job in flight), then also gelH -> both folded vs applied
    w.gate = new Promise((r) => (release = r));
    c.request(P({ gelH: 140, tolerance: 0.35 }));
    await until(c, () => w.jobs.length === 4);
    w.gate = null;
    c.request(P({ gelH: 145, tolerance: 0.35 }));
    await until(c, () => w.jobs.length === 5);
    expect([...w.jobs[4]!.parts].sort()).toEqual(['caddy', 'gloveTube', 'holster']);
    release();
    await settled(c);
    expect(c.getSnapshot().appliedParams).toMatchObject({ gelH: 145, tolerance: 0.35 });
  });

  it('(d) previous meshes stay until the new result arrives', async () => {
    const { w, c } = setup(10);
    c.request(DEFAULT_PARAMS);
    await settled(c);
    const prev = c.getSnapshot().meshes;
    w.latency = 150;
    c.request(P({ gelH: 150 }));
    await until(c, () => w.jobs.length === 2);
    const mid = c.getSnapshot();
    expect(mid.building).toBe(true);
    expect(mid.meshes).toBe(prev);
    await settled(c);
    expect(c.getSnapshot().meshes.caddy).not.toBe(prev.caddy);
  });

  it('(e) view-state changes never start jobs (criterion 6, client side)', async () => {
    const { c } = setup();
    c.request(DEFAULT_PARAMS);
    await settled(c);
    const n = c.getSnapshot().jobsStarted;
    const { useGeometryStore } = await import('../../store/geometryStore');
    for (let i = 0; i < 20; i++) useGeometryStore.setState({ building: false }); // unrelated store churn
    await sleep(300);
    expect(c.getSnapshot().jobsStarted).toBe(n);
    // an identical request (e.g. re-render) is a no-op build
    c.request(DEFAULT_PARAMS);
    await settled(c);
    expect(c.getSnapshot().jobsStarted).toBe(n);
  });

  it('reports errors without clearing meshes', async () => {
    const { w, c } = setup(10);
    c.request(DEFAULT_PARAMS);
    await settled(c);
    const prev = c.getSnapshot().meshes;
    w.postMessage = (req) => void w.onmessage?.({ data: { type: 'error', jobId: req.jobId, message: 'boom' } });
    c.request(P({ gelH: 150 }));
    await settled(c);
    expect(c.getSnapshot().error).toBe('boom');
    expect(c.getSnapshot().meshes).toBe(prev);
  });
});

describe('default mesh + node worker smoke', () => {
  it('public/default-assembly.bin decodes to the default active parts', () => {
    const b = readFileSync(fileURLToPath(new URL('../../../public/default-assembly.bin', import.meta.url)));
    const { params, parts } = decodeDefaultMesh(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    expect(params).toEqual(DEFAULT_PARAMS);
    expect(parts.map((p) => p.id).sort()).toEqual(['caddy', 'gloveTube', 'holster', 'plate']);
    expect(parts.every((p) => p.positions.length > 0 && p.indices.length % 3 === 0)).toBe(true);
  });

  it('worker_threads runs the job and transfers buffers', async () => {
    const w = new NodeWorker(fileURLToPath(new URL('./nodeWorkerBoot.mjs', import.meta.url)));
    try {
      const res = await new Promise<any>((resolve, reject) => {
        w.once('message', resolve);
        w.once('error', reject);
        w.postMessage({ type: 'build', jobId: 7, params: DEFAULT_PARAMS, parts: ['caddy'] });
      });
      expect(res.type).toBe('result');
      expect(res.jobId).toBe(7);
      expect(res.parts[0].id).toBe('caddy');
      expect(res.parts[0].positions).toBeInstanceOf(Float32Array);
      expect(res.parts[0].volume).toBeGreaterThan(0);
    } finally {
      await w.terminate();
    }
  }, 60000);
});
