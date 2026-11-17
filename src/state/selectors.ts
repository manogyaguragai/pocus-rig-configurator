import { useMemo } from 'react';
import { MAX_PART_SIZE, RIG_PARTS, type BBox, type PartId } from '../geometry';
import { useGeometryStore } from '../store/geometryStore';
import type { PartMesh } from '../worker/protocol';

type Meshes = Readonly<Partial<Record<PartId, PartMesh>>>;
export type Oversize = { id: PartId; dims: [number, number, number] };
export type RigStatus = { fits: boolean; partCount: number; oversize: Oversize[] };

const dimsOf = (b: BBox): [number, number, number] => [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];

export function activePartIds(meshes: Meshes): PartId[] {
  return RIG_PARTS.filter((id) => meshes[id]);
}

export function rigStatus(meshes: Meshes): RigStatus {
  const ids = activePartIds(meshes);
  const oversize: Oversize[] = [];
  for (const id of ids) {
    const dims = dimsOf(meshes[id]!.printBbox);
    if (dims.some((d) => d > MAX_PART_SIZE)) oversize.push({ id, dims });
  }
  return { fits: oversize.length === 0, partCount: ids.length, oversize };
}

export function useRigStatus(): RigStatus {
  const meshes = useGeometryStore((s) => s.meshes);
  return useMemo(() => rigStatus(meshes), [meshes]);
}

export function useActiveRigParts(): PartId[] {
  const meshes = useGeometryStore((s) => s.meshes);
  return useMemo(() => activePartIds(meshes), [meshes]);
}

export function useBuildState(): { building: boolean; lastMs: number | null; error: string | null } {
  const building = useGeometryStore((s) => s.building);
  const lastMs = useGeometryStore((s) => s.lastBuildMs);
  const error = useGeometryStore((s) => s.error);
  return useMemo(() => ({ building, lastMs, error }), [building, lastMs, error]);
}
