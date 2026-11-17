import type { Params } from '../geometry';
import { decodeDefaultMesh } from './defaultMeshFormat';
import type { PartMesh } from './protocol';

/** Fetches the prebuilt default assembly (public/default-assembly.bin); works on a sub-path. */
export async function loadDefaultMesh(): Promise<{ params: Params; parts: PartMesh[] }> {
  const res = await fetch(`${import.meta.env.BASE_URL}default-assembly.bin`);
  if (!res.ok) throw new Error(`default mesh: HTTP ${res.status}`);
  return decodeDefaultMesh(await res.arrayBuffer());
}
