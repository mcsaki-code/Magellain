import { create } from "zustand";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/constants";

interface MapState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  selectedBuoy: string | null;
  showChartOverlay: boolean;
  showWindArrows: boolean;
  showBuoyMarkers: boolean;

  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setPitch: (pitch: number) => void;
  setBearing: (bearing: number) => void;
  setSelectedBuoy: (buoyId: string | null) => void;
  toggleChartOverlay: () => void;
  toggleWindArrows: () => void;
  toggleBuoyMarkers: () => void;
  resetView: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: DEFAULT_MAP_CENTER,
  zoom: DEFAULT_MAP_ZOOM,
  pitch: 0,
  bearing: 0,
  selectedBuoy: null,
  showChartOverlay: true,
  showWindArrows: true,
  showBuoyMarkers: true,

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setPitch: (pitch) => set({ pitch }),
  setBearing: (bearing) => set({ bearing }),
  setSelectedBuoy: (buoyId) => set({ selectedBuoy: buoyId }),
  toggleChartOverlay: () => set((s) => ({ showChartOverlay: !s.showChartOverlay })),
  toggleWindArrows: () => set((s) => ({ showWindArrows: !s.showWindArrows })),
  toggleBuoyMarkers: () => set((s) => ({ showBuoyMarkers: !s.showBuoyMarkers })),
  resetView: () =>
    set({
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      pitch: 0,
      bearing: 0,
      selectedBuoy: null,
    }),
}));
