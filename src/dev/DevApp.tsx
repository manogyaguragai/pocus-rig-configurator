import { useEffect, useRef, useState } from 'react';
import { Viewport } from '../viewport/Viewport';
import { formatDims, positionsBBox } from '../viewport/pose';
import { DEFAULT_PARAMS, PART_META, RANGES, type Params } from '../geometry';
import { createBrowserWorker, GeometryClient } from '../worker/client';
import { loadDefaultMesh } from '../worker/defaultMesh';
import { connectGeometryClient, useGeometryStore } from '../store/geometryStore';
import { useViewStore } from '../store/viewStore';

// Temporary stand-in for the Phase 3 app shell: raw controls wired to the geometry client.
const SLIDERS = ['gelH', 'tolerance', 'cradleW', 'cradleD', 'holsterH'] as const;
const btn = (on: boolean): React.CSSProperties => ({
  font: '400 13px system-ui, sans-serif',
  padding: '5px 10px',
  border: '1px solid rgba(23,23,23,.14)',
  borderRadius: 8,
  background: on ? '#171717' : '#fff',
  color: on ? '#fff' : '#171717',
  cursor: 'pointer',
});

export function DevApp() {
  const clientRef = useRef<GeometryClient | null>(null);
  const [params, setParams] = useState<Params>({ ...DEFAULT_PARAMS });
  const { meshes, building, lastBuildMs, jobsStarted, workerReady, error } = useGeometryStore();
  const { viewMode, xray, selectedPart, setViewMode, toggleXray } = useViewStore();

  useEffect(() => {
    // Worker + WASM start in the background; the prebuilt mesh is shown as soon as it loads.
    const client = new GeometryClient(createBrowserWorker);
    clientRef.current = client;
    const off = connectGeometryClient(client);
    (window as unknown as { __client: GeometryClient }).__client = client;
    loadDefaultMesh().then(
      (d) => client.seed(d.parts, d.params),
      () => {},
    );
    return () => {
      off();
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  const change = (patch: Partial<Params>) => {
    const next = { ...params, ...patch };
    setParams(next);
    clientRef.current?.request(next);
  };

  const view = Object.fromEntries(Object.entries(meshes).map(([k, m]) => [k, { positions: m!.positions, indices: m!.indices }]));
  const sel = selectedPart ? view[selectedPart] : undefined;
  const label: React.CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', font: '400 12px system-ui, sans-serif' };

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Viewport meshes={view} />
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,.9)', padding: 10, borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button id="btn-assembled" style={btn(viewMode === 'assembled')} onClick={() => setViewMode('assembled')}>Assembled</button>
          <button id="btn-exploded" style={btn(viewMode === 'exploded')} onClick={() => setViewMode('exploded')}>Exploded</button>
          <button id="btn-xray" style={btn(xray)} aria-pressed={xray} onClick={toggleXray}>X-ray</button>
        </div>
        {SLIDERS.map((k) => (
          <label key={k} style={label}>
            <span style={{ width: 70 }}>{k}</span>
            <input id={`s-${k}`} type="range" min={RANGES[k].min} max={RANGES[k].max} step={RANGES[k].step} value={params[k]} onChange={(e) => change({ [k]: Number(e.target.value) })} />
            <span style={{ font: '400 12px monospace' }}>{params[k]}</span>
          </label>
        ))}
        <label style={label}>
          <span style={{ width: 70 }}>glove</span>
          <select id="s-glove" value={params.gloveMode} onChange={(e) => change({ gloveMode: e.target.value as Params['gloveMode'] })}>
            <option value="tube">tube</option>
            <option value="box">box</option>
          </select>
        </label>
        <label style={label}>
          <span style={{ width: 70 }}>mount</span>
          <select id="s-mount" value={params.mount} onChange={(e) => change({ mount: e.target.value as Params['mount'] })}>
            {(['tape', 'vesa', 'amps', 'magnets', 'ivpole'] as const).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <div id="readout" style={{ font: '400 12px monospace', color: '#525252' }}>
          building={String(building)} lastMs={lastBuildMs === null ? '-' : Math.round(lastBuildMs)} jobsStarted={jobsStarted} workerReady={String(workerReady)}
          {error ? ` error=${error}` : ''}
        </div>
      </div>
      {selectedPart && sel && (
        <div style={{ position: 'absolute', left: 12, bottom: 12, font: '400 14px system-ui, sans-serif' }}>
          {PART_META[selectedPart].label} <span style={{ font: '400 13px monospace' }}>{formatDims(positionsBBox(sel.positions))}</span>
        </div>
      )}
    </div>
  );
}
