import { create } from "zustand";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/constants";

// ─── Track Point type ───────────────────────────────────────────

export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed_kts?: number | null;
  heading?: number | null;
}

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

interface TrackMeta {
  date: string;
  distance_nm: number;
  duration_s: number;
  max_speed_kts: number;
}

export interface StartLine {
  boatEnd: [number, number] | null;   // [lng, lat]
  committeeEnd: [number, number] | null;
}

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

  // Track replay state
  activeTrackPoints: TrackPoint[] | null;
  activeTrackId: string | null;
  activeTrackMeta: TrackMeta | null;
  playbackIndex: number;
  isReplaying: boolean;

  // Start line state
  startLine: StartLine;
  startLinePlacing: "boat" | "committee" | null;
  showStartLineTool: boolean;

  // Wind shift state
  showWindShift: boolean;

  // Laylines state
  showLaylines: boolean;
  tackingAngle: number; // degrees off the wind (default 42°)

  // Race checklist state
  showChecklist: boolean;

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

  // Track replay actions
  setActiveTrack: (id: string, points: TrackPoint[], meta: TrackMeta) => void;
  clearActiveTrack: () => void;
  setPlaybackIndex: (index: number) => void;
  setIsReplaying: (isReplaying: boolean) => void;

  // Start line actions
  setStartLineEnd: (end: "boat" | "committee", lngLat: [number, number]) => void;
  clearStartLine: () => void;
  setStartLinePlacing: (mode: "boat" | "committee" | null) => void;
  setShowStartLineTool: (show: boolean) => void;

  // Wind shift actions
  toggleWindShift: () => void;

  // Laylines actions
  toggleLaylines: () => void;
  setTackingAngle: (angle: number) => void;

  // Race checklist actions
  toggleChecklist: () => void;
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

  // Track replay defaults
  activeTrackPoints: null,
  activeTrackId: null,
  activeTrackMeta: null,
  playbackIndex: 0,
  isReplaying: false,

  // Start line defaults
  startLine: { boatEnd: null, committeeEnd: null },
  startLinePlacing: null,
  showStartLineTool: false,

  // Wind shift defaults
  showWindShift: false,

  // Laylines defaults
  showLaylines: false,
  tackingAngle: 42,

  // Race checklist defaults
  showChecklist: false,

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

  // Track replay actions
  setActiveTrack: (id, points, meta) =>
    set({
      activeTrackId: id,
      activeTrackPoints: points,
      activeTrackMeta: meta,
      playbackIndex: 0,
      isReplaying: false,
    }),
  clearActiveTrack: () =>
    set({
      activeTrackId: null,
      activeTrackPoints: null,
      activeTrackMeta: null,
      playbackIndex: 0,
      isReplaying: false,
    }),
  setPlaybackIndex: (index) => set({ playbackIndex: index }),
  setIsReplaying: (isReplaying) => set({ isReplaying }),

  // Start line actions
  setStartLineEnd: (end, lngLat) =>
    set((s) => ({
      startLine: {
        ...s.startLine,
        boatEnd: end === "boat" ? lngLat : s.startLine.boatEnd,
        committeeEnd: end === "committee" ? lngLat : s.startLine.committeeEnd,
      },
      startLinePlacing: null,
    })),
  clearStartLine: () =>
    set({ startLine: { boatEnd: null, committeeEnd: null }, startLinePlacing: null }),
  setStartLinePlacing: (mode) => set({ startLinePlacing: mode }),
  // Start line — mutually exclusive with other tool panels
  setShowStartLineTool: (show) =>
    set((s) => ({
      showStartLineTool: show,
      showWindShift: show ? false : s.showWindShift,
      showChecklist: show ? false : s.showChecklist,
    })),

  // Wind shift actions — mutually exclusive with other tool panels
  toggleWindShift: () =>
    set((s) => ({
      showWindShift: !s.showWindShift,
      showChecklist: false,
      showStartLineTool: s.showWindShift ? s.showStartLineTool : false,
    })),

  // Laylines actions
  toggleLaylines: () => set((s) => ({ showLaylines: !s.showLaylines })),
  setTackingAngle: (angle) => set({ tackingAngle: angle }),

  // Race checklist actions — mutually exclusive with other tool panels
  toggleChecklist: () =>
    set((s) => ({
      showChecklist: !s.showChecklist,
      showWindShift: false,
      showStartLineTool: s.showChecklist ? s.showStartLineTool : false,
    })),
}));
