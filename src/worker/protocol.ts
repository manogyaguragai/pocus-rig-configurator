import type { BBox, Params, PartId } from '../geometry';

/**
 * Worker protocol.
 *
 * Meshes are sent in the BLENDER frame, exactly as the part builders produce them: unlifted,
 * no exploded offset, no print rotation. The viewport applies the pose itself with
 * `assemblyOffset(id, exploded)` from src/geometry/placement.ts, so Assembled/Exploded and
 * other view changes never reach the worker. All typed arrays are transferred, not copied.
 */

export type BuildRequest = {
  type: 'build';
  jobId: number;
  /** Full, already clamped params. */
  params: Params;
  /** Only the parts that must be rebuilt. */
  parts: PartId[];
};

export type PartMesh = {
  id: PartId;
  positions: Float32Array;
  indices: Uint32Array;
  /** Bounding box in print orientation (mm). */
  printBbox: BBox;
  /** mm^3 */
  volume: number;
};

export type BuildResult = { type: 'result'; jobId: number; parts: PartMesh[]; ms: number };
export type BuildError = { type: 'error'; jobId: number; message: string };
export type WorkerReady = { type: 'ready' };

export type WorkerRequest = BuildRequest;
export type WorkerResponse = BuildResult | BuildError | WorkerReady;

/** The slice of the Worker interface the client uses; tests inject a fake. */
export interface WorkerLike {
  postMessage(msg: WorkerRequest): void;
  terminate(): void;
  onmessage: ((ev: { data: WorkerResponse }) => void) | null;
  onerror: ((ev: { message?: string }) => void) | null;
}
