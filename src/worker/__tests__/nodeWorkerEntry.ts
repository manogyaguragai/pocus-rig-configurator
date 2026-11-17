import { parentPort } from 'node:worker_threads';
import { runBuildJob } from '../buildJob';

// Node stand-in for geometry.worker.ts: same runBuildJob, worker_threads transport.
parentPort!.on('message', async (req) => {
  const { result, transfer } = await runBuildJob(req);
  parentPort!.postMessage(result, transfer);
});
