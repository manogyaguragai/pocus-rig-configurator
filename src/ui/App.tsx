import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Ruler, ScanEye } from 'lucide-react';
import { Viewport, type PartMeshes } from '../viewport/Viewport';
import { PART_META, type BBox, type PartId } from '../geometry/types';
import { useGeometryStore } from '../store/geometryStore';
import { useViewStore, type ViewMode } from '../store/viewStore';
import { startApp } from '../state/app';
import { useActiveRigParts, useBuildState } from '../state/selectors';
import { ICON, Segmented } from './Controls';
import { Panel, StatusRow } from './Panel';
import { Credit } from './Credit';
import { Mark } from './Mark';
import { PartsList } from './PartsList';
import { defaultExportHandlers, useExportStore, type ExportHandlers } from './exportHooks';
import { formatBBoxDims, largestPartDims, partCountText, printNote } from './format';

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'assembled', label: 'Assembled' },
  { value: 'exploded', label: 'Exploded' },
];

export function App(props: Partial<ExportHandlers> = {}) {
  const handlers: ExportHandlers = { ...defaultExportHandlers, ...props };
  const [sheetOpen, setSheetOpen] = useState(false);
  const meshes = useGeometryStore((s) => s.meshes);
  const active = useActiveRigParts();
  const build = useBuildState();
  const viewMode = useViewStore((s) => s.viewMode);
  const setViewMode = useViewStore((s) => s.setViewMode);
  const xray = useViewStore((s) => s.xray);
  const toggleXray = useViewStore((s) => s.toggleXray);
  const selected = useViewStore((s) => s.selectedPart);
  const clearSelection = useViewStore((s) => s.clearSelection);

  useEffect(() => startApp(), []);

  const view: PartMeshes = useMemo(() => {
    const out: PartMeshes = {};
    for (const id of active) {
      const m = meshes[id];
      if (m) out[id] = { positions: m.positions, indices: m.indices };
    }
    return out;
  }, [meshes, active]);

  // A part that stops existing (glove holder or mount change) cannot stay selected.
  useEffect(() => {
    if (selected && !active.includes(selected)) clearSelection();
  }, [selected, active, clearSelection]);

  const exportBusy = useExportStore((s) => s.busy);
  const exportError = useExportStore((s) => s.error);

  const selMesh = selected ? meshes[selected] : undefined;
  const selectPart = useViewStore((s) => s.selectPart);
  const boxes = useMemo(() => {
    const out: Partial<Record<PartId, BBox>> = {};
    for (const id of active) if (meshes[id]) out[id] = meshes[id]!.printBbox;
    return out;
  }, [meshes, active]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Mark />
          <span>POCUS rig</span>
          <span className="brand-sub">configurator</span>
        </div>
        <div className="spacer" />
        <button
          type="button"
          className="link"
          aria-label="Calibration piece"
          title="Calibration piece"
          disabled={exportBusy !== null}
          aria-busy={exportBusy === 'calibration'}
          onClick={handlers.onExportCalibration}
        >
          <Ruler {...ICON} />
          <span>{exportBusy === 'calibration' ? 'Building piece' : 'Calibration piece'}</span>
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={exportBusy !== null}
          aria-busy={exportBusy === 'kit'}
          onClick={handlers.onExportKit}
        >
          <Download {...ICON} />
          <span>{exportBusy === 'kit' ? 'Building kit' : 'Download print kit'}</span>
        </button>
      </header>

      <main className="main">
        <div className="stage">
          <div className="view">
            <Viewport meshes={view} />
            <div className="tools">
              <Segmented label="View" value={viewMode} options={VIEW_OPTIONS} onChange={setViewMode} className="tools-seg" />
              <button type="button" className="btn secondary xray" aria-pressed={xray} onClick={toggleXray}>
                <ScanEye {...ICON} />
                <span>X-ray</span>
              </button>
            </div>
            <div className="bed num">256 × 256 mm bed</div>
            {(build.error || exportError) && (
              <p className="build-error" role="alert">
                {exportError ?? build.error}
              </p>
            )}
          </div>
          <div className="bar">
            <PartsList parts={active} boxes={boxes} selected={selected} onSelect={selectPart} />
            <div className="readout" aria-live="polite">
              {selected ? (
                <>
                  <div className="readout-main">
                    <span className="part">
                      <span className={`swatch ${PART_META[selected].material}`} aria-hidden="true" />
                      {PART_META[selected].label}
                    </span>
                    <span className="num bar-dims">{selMesh ? formatBBoxDims(selMesh.printBbox) : ''}</span>
                    <span className="meta note">{printNote(selected)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={exportBusy !== null}
                    aria-busy={exportBusy === 'part'}
                    onClick={() => handlers.onExportPartStl(selected)}
                  >
                    <Download {...ICON} />
                    <span>{exportBusy === 'part' ? 'Building STL' : 'Part STL'}</span>
                  </button>
                </>
              ) : (
                <div className="readout-main quiet">
                  <span className="part">{partCountText(active.length)}</span>
                  {largestPartDims(Object.values(boxes)) && (
                    <>
                      <span className="meta">Largest print size</span>
                      <span className="num bar-dims">{largestPartDims(Object.values(boxes))}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className={`side${sheetOpen ? ' open' : ''}`}>
          <button
            type="button"
            className="sheet-handle"
            aria-expanded={sheetOpen}
            aria-controls="settings-panel"
            onClick={() => setSheetOpen((o) => !o)}
          >
            <span className="grip" aria-hidden="true" />
            <span className="sheet-title">Settings</span>
            {sheetOpen ? <ChevronDown {...ICON} /> : <ChevronUp {...ICON} />}
          </button>
          <div id="settings-panel" className="sheet-body">
            <Panel />
          </div>
          <StatusRow />
          <Credit />
        </aside>
      </main>
    </div>
  );
}
