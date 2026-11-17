import { create } from 'zustand';
import type { PartId } from '../geometry/types';
import { CALIB_PARTS } from '../geometry/types';
import { calibrationZipName, kitZipName, stlFileName } from '../exports/names';
import { buildCalibrationKit, buildPrintKit } from '../exports/kit';
import { toPrintMesh } from '../exports/print';
import { encodeBinaryStl } from '../exports/stl';
import { getGeometryClient } from '../state/app';
import { downloadBytes } from './download';

export type ExportKind = 'kit' | 'calibration' | 'part';
type ExportState = { busy: ExportKind | null; error: string | null };

/** Busy flag and short error message for the export buttons. */
export const useExportStore = create<ExportState>()(() => ({ busy: null, error: null }));

async function run(kind: ExportKind, job: () => Promise<void>): Promise<void> {
  if (useExportStore.getState().busy) return;
  useExportStore.setState({ busy: kind, error: null });
  try {
    await job();
    useExportStore.setState({ busy: null });
  } catch (e) {
    useExportStore.setState({ busy: null, error: e instanceof Error ? e.message : 'Export failed' });
  }
}

function applied() {
  const client = getGeometryClient();
  const snap = client?.getSnapshot();
  if (!client || !snap) throw new Error('The model is still loading');
  if (!snap.appliedParams) throw new Error('The model is still loading');
  if (snap.building) throw new Error('Wait for the rebuild to finish');
  return { client, params: snap.appliedParams, meshes: snap.meshes };
}

export const onExportKit = (): Promise<void> =>
  run('kit', async () => {
    const { params, meshes } = applied();
    downloadBytes(buildPrintKit(params, meshes), kitZipName(params.tolerance), 'application/zip');
  });

export const onExportCalibration = (): Promise<void> =>
  run('calibration', async () => {
    const { client, params } = applied();
    const meshes = await client.buildOnce(params, [...CALIB_PARTS]);
    downloadBytes(buildCalibrationKit(params, meshes), calibrationZipName(params.tolerance), 'application/zip');
  });

/** `part` is the selected part, or null when nothing is selected. */
export const onExportPartStl = (part: PartId | null): Promise<void> =>
  run('part', async () => {
    if (!part) throw new Error('Select a part first');
    const { params, meshes } = applied();
    const m = meshes[part];
    if (!m) throw new Error('That part is not built yet');
    const p = toPrintMesh(part, m);
    downloadBytes(encodeBinaryStl(p.positions, p.indices, part), stlFileName(part, params.tolerance), 'model/stl');
  });

export type ExportHandlers = {
  onExportKit: () => void;
  onExportCalibration: () => void;
  onExportPartStl: (part: PartId | null) => void;
};

export const defaultExportHandlers: ExportHandlers = { onExportKit, onExportCalibration, onExportPartStl };
