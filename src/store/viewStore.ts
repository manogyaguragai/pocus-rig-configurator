import { create } from 'zustand';
import type { PartId } from '../geometry/types';

// View-only state. Must never import the geometry client or worker: changing any of this
// is a pure re-pose / re-style on the main thread and never starts geometry work.
export type ViewMode = 'assembled' | 'exploded';

type ViewState = {
  viewMode: ViewMode;
  xray: boolean;
  selectedPart: PartId | null;
  setViewMode: (m: ViewMode) => void;
  toggleViewMode: () => void;
  setXray: (on: boolean) => void;
  toggleXray: () => void;
  selectPart: (id: PartId | null) => void;
  clearSelection: () => void;
};

export const useViewStore = create<ViewState>((set) => ({
  viewMode: 'assembled',
  xray: false,
  selectedPart: null,
  setViewMode: (viewMode) => set({ viewMode }),
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'assembled' ? 'exploded' : 'assembled' })),
  setXray: (xray) => set({ xray }),
  toggleXray: () => set((s) => ({ xray: !s.xray })),
  selectPart: (selectedPart) => set({ selectedPart }),
  clearSelection: () => set({ selectedPart: null }),
}));
