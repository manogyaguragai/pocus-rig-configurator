import { useEffect, useState } from 'react';
import { Viewport } from './Viewport';
import type { PartMeshes } from './pose';
import { formatDims, positionsBBox } from './pose';
import { PART_META, type PartId } from '../geometry/types';
import { useViewStore } from '../store/viewStore';

/** Where the harness gets meshes. Phase 3 replaces this with the geometry store. */
export interface MeshSource {
  load(): Promise<PartMeshes>;
}

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const positions = new Float32Array([
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
  ]);
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
  ]);
  return { positions, indices };
}

/** Viewport-only stand-in boxes (rough default envelopes). Not geometry output. */
const placeholderSource: MeshSource = {
  async load() {
    return {
      plate: box(-62, 62, 0, 8, -35, 135),
      holster: box(-35, 35, -60, -8, 0, 100),
      caddy: box(43, 112, -50, -8, 0, 128),
      gloveTube: box(-110, -45, -60, 5, 0, 110),
    };
  },
};

// Another agent provides src/worker/defaultMesh.ts (loadDefaultMesh) and public/default-assembly.bin.
// The glob is empty until that file exists, so this builds either way.
const defaultMeshModules = import.meta.glob('../worker/defaultMesh.ts');

const defaultAssemblySource: MeshSource = {
  async load() {
    const loader = Object.values(defaultMeshModules)[0];
    if (!loader) return placeholderSource.load();
    const mod = (await loader()) as {
      loadDefaultMesh?: () => Promise<{ parts: { id: PartId; positions: Float32Array; indices: Uint32Array }[] }>;
    };
    if (!mod.loadDefaultMesh) return placeholderSource.load();
    try {
      const out: PartMeshes = {};
      for (const p of (await mod.loadDefaultMesh()).parts) out[p.id] = { positions: p.positions, indices: p.indices };
      return out;
    } catch {
      return placeholderSource.load();
    }
  },
};

export function DevHarness({ source = defaultAssemblySource }: { source?: MeshSource }) {
  const [meshes, setMeshes] = useState<PartMeshes>({});
  const { viewMode, xray, selectedPart, setViewMode, toggleXray } = useViewStore();

  useEffect(() => {
    let live = true;
    source.load().then((m) => live && setMeshes(m), () => live && setMeshes({}));
    return () => {
      live = false;
    };
  }, [source]);

  const sel = selectedPart ? meshes[selectedPart] : undefined;
  const btn = (on: boolean): React.CSSProperties => ({
    font: '400 14px system-ui, sans-serif',
    padding: '6px 12px',
    border: '1px solid rgba(23,23,23,.14)',
    borderRadius: 8,
    background: on ? '#171717' : '#fff',
    color: on ? '#fff' : '#171717',
    cursor: 'pointer',
  });

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Viewport meshes={meshes} />
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8 }}>
        <button style={btn(viewMode === 'assembled')} onClick={() => setViewMode('assembled')}>Assembled</button>
        <button style={btn(viewMode === 'exploded')} onClick={() => setViewMode('exploded')}>Exploded</button>
        <button style={btn(xray)} aria-pressed={xray} onClick={toggleXray}>X-ray</button>
      </div>
      <div style={{ position: 'absolute', top: 20, right: 16, font: '400 12px "IBM Plex Mono", monospace', color: '#737373' }}>
        256 × 256 mm bed
      </div>
      {selectedPart && sel && (
        <div style={{ position: 'absolute', left: 16, bottom: 16, font: '400 14px system-ui, sans-serif', color: '#171717' }}>
          {PART_META[selectedPart].label}{' '}
          <span style={{ font: '400 13px "IBM Plex Mono", monospace', color: '#525252' }}>{formatDims(positionsBBox(sel.positions))}</span>
        </div>
      )}
    </div>
  );
}
