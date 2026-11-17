import type { PartId } from '../geometry/types';

// Phase 4 replaces these. They are intentionally empty: the buttons render but do nothing yet.
export function onExportKit(): void {}
export function onExportCalibration(): void {}
/** `part` is the selected part, or null when nothing is selected. */
export function onExportPartStl(part: PartId | null): void {
  void part;
}

export type ExportHandlers = {
  onExportKit: () => void;
  onExportCalibration: () => void;
  onExportPartStl: (part: PartId | null) => void;
};

export const defaultExportHandlers: ExportHandlers = { onExportKit, onExportCalibration, onExportPartStl };
