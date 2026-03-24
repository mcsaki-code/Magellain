import { create } from "zustand";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/constants";

// ─── Course-related types ───────────────────────────────────────

interface RaceCourse {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  course_type: string;
  distance_nm: number | null;
}

interface CourseLeg {
  leg_order: number;
  rounding: string;
  notes: string | null;
  mark: {
    id: string;
    name: string;
    short_name: string;
    latitude: number;
    longitude: number;
    mark_type: string;
    color: string | null;
  };
}

// ─── Store ──────────────────────────────────────────────────────

interface MapState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  selectedBuoy: string | null;
  showChartOverlay: boolean;
  showWindArrows: boolean;
  showBuoyMarkers: boolean;

  // Course overlay state
  selectedCourse: RaceCourse | null;
  courseLegs: CourseLeg[];
  showCourseOverlay: boolean;
  showTacticalAnalysis: boolean;

  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setPitch: (pitch: number) => void;
  setBearing: (bearing: number) => void;
  setSelectedBuoy: (buoyId: string | null) => void;
  toggleChartOverlay: () => void;
  toggleWindArrows: () => void;
  toggleBuoyMarkers: () => void;
  resetView: () => void;

  // Course overlay actions
  setSelectedCourse: (course: RaceCourse | null) => void;
  setCourseLegs: (legs: CourseLeg[]) => void;
  toggleCourseOverlay: () => void;
  setShowTacticalAnalysis: (show: boolean) => void;
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

  // Course overlay defaults
  selectedCourse: null,
  courseLegs: [],
  showCourseOverlay: true,
  showTacticalAnalysis: false,

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

  // Course overlay actions
  setSelectedCourse: (course) => set({ selectedCourse: course, showTacticalAnalysis: false }),
  setCourseLegs: (legs) => set({ courseLegs: legs }),
  toggleCourseOverlay: () => set((s) => ({ showCourseOverlay: !s.showCourseOverlay })),
  setShowTacticalAnalysis: (show) => set({ showTacticalAnalysis: show }),
}));
