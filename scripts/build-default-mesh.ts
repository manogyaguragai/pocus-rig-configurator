import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { activeParts, buildPart, DEFAULT_PARAMS, loadManifold } from '../src/geometry';
import { encodeDefaultMesh } from '../src/worker/defaultMeshFormat';
import type { PartMesh } from '../src/worker/protocol';

const api = await loadManifold();
const parts: PartMesh[] = [];
for (const id of activeParts(DEFAULT_PARAMS)) {
  const r = await buildPart(id, DEFAULT_PARAMS, api);
  parts.push({ id, positions: r.mesh.positions, indices: r.mesh.indices, printBbox: r.printBBox, volume: r.volume });
}
const bytes = encodeDefaultMesh({ ...DEFAULT_PARAMS }, parts);
const out = new URL('../public/default-assembly.bin', import.meta.url);
mkdirSync(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });
writeFileSync(out, bytes);
process.stdout.write(`default-assembly.bin: ${bytes.length} bytes, ${parts.length} parts\n`);
