/// <reference lib="webworker" />
import { loadManifold } from '../geometry';
import { runBuildJob } from './buildJob';
import type { WorkerRequest, WorkerResponse } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: WorkerResponse, transfer: Transferable[] = []) => ctx.postMessage(msg, transfer);

// Messages arriving while WASM loads wait on the same cached promise inside runBuildJob.
ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  if (req.type === 'buildOnce') {
    try {
      const { result, transfer } = await runBuildJob({ type: 'build', jobId: req.requestId, params: req.params, parts: req.parts });
      post({ type: 'onceResult', requestId: req.requestId, parts: result.parts, ms: result.ms }, transfer);
    } catch (e) {
      post({ type: 'onceError', requestId: req.requestId, message: e instanceof Error ? e.message : String(e) });
    }
    return;
  }
  if (req.type !== 'build') return;
  try {
    const { result, transfer } = await runBuildJob(req);
    post(result, transfer);
  } catch (e) {
    post({ type: 'error', jobId: req.jobId, message: e instanceof Error ? e.message : String(e) });
  }
};

loadManifold().then(
  () => post({ type: 'ready' }),
  () => {
    /* surfaced as an error on the first build job */
  },
);
