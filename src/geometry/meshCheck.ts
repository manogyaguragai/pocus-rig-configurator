import type { MeshData } from './manifold';

export type EdgeReport = {
  /** undirected edges that are not shared by exactly 2 triangles with opposite orientation */
  nonManifoldEdges: number;
  /** triangles referencing a degenerate (repeated) vertex after position welding */
  degenerateTris: number;
  /** vertices not referenced by any triangle */
  looseVerts: number;
};

/**
 * Mesh-level watertightness check on raw triangle data (independent of Manifold's own status).
 * Vertices are welded by exact position so split-vertex meshes are judged geometrically.
 * Every directed edge a->b must occur exactly once and be matched by exactly one b->a;
 * anything else (open boundary, T-junction, 3+ triangles on an edge, same-direction
 * duplicate = inconsistent winding) counts as a non-manifold undirected edge.
 */
export function checkMeshEdges(mesh: MeshData): EdgeReport {
  const { positions, indices } = mesh;
  const nv = positions.length / 3;
  const weld = new Map<string, number>();
  const canon = new Uint32Array(nv);
  for (let i = 0; i < nv; i++) {
    const k = `${positions[i * 3]},${positions[i * 3 + 1]},${positions[i * 3 + 2]}`;
    let id = weld.get(k);
    if (id === undefined) { id = weld.size; weld.set(k, id); }
    canon[i] = id;
  }
  const n = weld.size;
  const directed = new Map<number, number>(); // a * n + b -> count (n^2 stays < 2^53 for any real mesh)
  const used = new Uint8Array(n);
  let degenerate = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = canon[indices[t]!]!, b = canon[indices[t + 1]!]!, c = canon[indices[t + 2]!]!;
    if (a === b || b === c || a === c) { degenerate++; continue; }
    used[a] = used[b] = used[c] = 1;
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      const k = u * n + v;
      directed.set(k, (directed.get(k) ?? 0) + 1);
    }
  }
  let bad = 0;
  const seen = new Set<number>();
  for (const [k, cnt] of directed) {
    const u = Math.floor(k / n), v = k % n;
    const key = u < v ? u * n + v : v * n + u;
    if (seen.has(key)) continue;
    seen.add(key);
    const rev = directed.get(v * n + u) ?? 0;
    if (cnt !== 1 || rev !== 1) bad++;
  }
  let loose = 0;
  for (let i = 0; i < n; i++) if (!used[i]) loose++;
  return { nonManifoldEdges: bad, degenerateTris: degenerate, looseVerts: loose };
}

export function isWatertight(mesh: MeshData): boolean {
  return checkMeshEdges(mesh).nonManifoldEdges === 0;
}
