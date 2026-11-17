import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, type Params } from '../../geometry';
import { GeometryClient } from '../client';
import { runBuildJob } from '../buildJob';
import type { WorkerLike, WorkerRequest } from '../protocol';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const P = (o: Partial<Params> = {}): Params => ({ ...DEFAULT_PARAMS, ...o });

/** In-process worker that answers both request kinds; once results can be held back. */
class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null;
  onerror: WorkerLike['onerror'] = null;
  requests: WorkerRequest[] = [];
  holdOnce: Promise<void> | null = null;
  postMessage(req: WorkerRequest) {
    this.requests.push(req);
    void (async () => {
      if (req.type === 'buildOnce') {
        const hold = this.holdOnce;
        const { result } = await runBuildJob({ type: 'build', jobId: req.requestId, params: req.params, parts: req.parts });
        if (hold) await hold;
        this.onmessage?.({ data: { type: 'onceResult', requestId: req.requestId, parts: result.parts, ms: result.ms } });
      } else {
        const { result } = await runBuildJob(req);
        this.onmessage?.({ data: result });
      }
    })();
  }
  terminate() {}
}

const settled = async (c: GeometryClient) => {
  for (let i = 0; i < 3000 && c.getSnapshot().building; i++) await sleep(10);
};

describe('GeometryClient.buildOnce', () => {
  it('returns the requested parts and does not touch the snapshot or jobsStarted', async () => {
    const w = new FakeWorker();
    const c = new GeometryClient(() => w, { debounceMs: 10 });
    const before = c.getSnapshot();
    const out = await c.buildOnce(DEFAULT_PARAMS, ['calibMale', 'calibFemale']);
    expect(Object.keys(out).sort()).toEqual(['calibFemale', 'calibMale']);
    expect(out.calibMale!.positions.length).toBeGreaterThan(0);
    expect(c.getSnapshot()).toBe(before);
    expect(c.getSnapshot().jobsStarted).toBe(0);
    expect(c.onceStarted).toBe(1);
  });

  it('slider changes during a one-off build neither cancel it nor are cancelled by it', async () => {
    const w = new FakeWorker();
    const c = new GeometryClient(() => w, { debounceMs: 10 });
    c.request(DEFAULT_PARAMS);
    await settled(c);
    let release!: () => void;
    w.holdOnce = new Promise((r) => (release = r));
    const once = c.buildOnce(DEFAULT_PARAMS, ['calibFemaleLo']);
    w.holdOnce = null;
    const base = c.getSnapshot().jobsStarted;
    for (let i = 0; i < 5; i++) {
      c.request(P({ gelH: 100 + i }));
      await sleep(20);
    }
    await settled(c); // latest-job-wins still applies the final params
    expect(c.getSnapshot().appliedParams!.gelH).toBe(104);
    expect(c.getSnapshot().jobsStarted - base).toBeGreaterThanOrEqual(1);
    release();
    const out = await once; // one-off result arrives after, still delivered
    expect(out.calibFemaleLo).toBeDefined();
    // the one-off result did not replace or add anything in the applied meshes
    expect(Object.keys(c.getSnapshot().meshes).sort()).toEqual(['caddy', 'gloveTube', 'holster', 'plate']);
    expect(c.getSnapshot().appliedParams!.gelH).toBe(104);
  });

  it('a one-off request while a normal job is in flight does not make that job stale', async () => {
    const w = new FakeWorker();
    const c = new GeometryClient(() => w, { debounceMs: 10 });
    c.request(P({ gelH: 120 }));
    while (w.requests.length === 0) await sleep(5);
    await c.buildOnce(DEFAULT_PARAMS, ['calibMale']);
    await settled(c);
    expect(c.getSnapshot().appliedParams!.gelH).toBe(120);
    expect(c.getSnapshot().jobsStarted).toBe(1);
  });

  it('rejects on a worker error message and on dispose', async () => {
    const w = new FakeWorker();
    w.postMessage = (req) => void w.onmessage?.({ data: { type: 'onceError', requestId: (req as { requestId: number }).requestId, message: 'boom' } });
    const c = new GeometryClient(() => w, { debounceMs: 10 });
    await expect(c.buildOnce(DEFAULT_PARAMS, ['calibMale'])).rejects.toThrow('boom');
    w.postMessage = () => {};
    const pending = c.buildOnce(DEFAULT_PARAMS, ['calibMale']);
    c.dispose();
    await expect(pending).rejects.toThrow();
  });
});
