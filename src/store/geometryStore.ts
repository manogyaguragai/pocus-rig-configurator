import { create } from 'zustand';
import type { PartId } from '../geometry';
import type { GeometryClient, GeometrySnapshot } from '../worker/client';
import type { PartMesh } from '../worker/protocol';

export type GeometryState = {
  meshes: Readonly<Partial<Record<PartId, PartMesh>>>;
  building: boolean;
  lastBuildMs: number | null;
  error: string | null;
  workerReady: boolean;
  jobsStarted: number;
};

export const useGeometryStore = create<GeometryState>()(() => ({
  meshes: {},
  building: false,
  lastBuildMs: null,
  error: null,
  workerReady: false,
  jobsStarted: 0,
}));

const fromSnapshot = (s: GeometrySnapshot): GeometryState => ({
  meshes: s.meshes,
  building: s.building,
  lastBuildMs: s.lastMs,
  error: s.error,
  workerReady: s.workerReady,
  jobsStarted: s.jobsStarted,
});

/** Mirrors the client into the store. Returns the unsubscribe function. */
export function connectGeometryClient(client: GeometryClient): () => void {
  useGeometryStore.setState(fromSnapshot(client.getSnapshot()));
  return client.subscribe(() => useGeometryStore.setState(fromSnapshot(client.getSnapshot())));
}
