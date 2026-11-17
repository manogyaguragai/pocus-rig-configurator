import { buildPart, loadManifold } from '../geometry';
import type { BuildRequest, BuildResult, PartMesh } from './protocol';

/** Runs one build job. Pure of worker globals so it can run in a Worker, Node or a test. */
export async function runBuildJob(req: BuildRequest): Promise<{ result: BuildResult; transfer: ArrayBuffer[] }> {
  const t0 = performance.now();
  const api = await loadManifold();
  const parts: PartMesh[] = [];
  for (const id of req.parts) {
    // buildPart frees every WASM object in a finally block; only plain data comes back.
    const r = await buildPart(id, req.params, api);
    parts.push({
      id,
      positions: r.mesh.positions,
      indices: r.mesh.indices,
      printBbox: r.printBBox,
      volume: r.volume,
    });
  }
  const transfer = parts.flatMap((p) => [p.positions.buffer as ArrayBuffer, p.indices.buffer as ArrayBuffer]);
  return { result: { type: 'result', jobId: req.jobId, parts, ms: performance.now() - t0 }, transfer };
}
