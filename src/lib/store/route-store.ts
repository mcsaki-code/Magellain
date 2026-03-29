import { create } from "zustand";

// ─── Types ────────────────────────────────────────────────

export interface Waypoint {
  lat: number;
  lng: number;
  name?: string;
  notes?: string | null;
}

export interface PassageRoute {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  departure_name: string;
  departure_lat: number;
  departure_lng: number;
  arrival_name: string;
  arrival_lat: number;
  arrival_lng: number;
  waypoints: Waypoint[];
  rhumb_line_distance_nm: number | null;
  difficulty: string | null;
  course_type: string | null;
  region: string | null;
  is_system: boolean;
  is_public: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface RouteComputation {
  id: string;
  passage_id: string | null;
  boat_id: string;
  departure_time: string;
  estimated_arrival: string | null;
  status: "computing" | "complete" | "failed";
  optimal_route: { type: "LineString"; coordinates: number[][] } | null;
  weather_data: { observations_used: number; stations_available: number } | null;
  sail_changes: Array<{
    leg: number;
    from_sail: string;
    to_sail: string;
    reason: string;
  }>;
  recommended_sails: string[];
  risk_level: "low" | "moderate" | "high" | "extreme";
  risk_factors: string[];
  total_distance_nm: number | null;
  estimated_duration_hours: number | null;
  avg_speed_knots: number | null;
  max_speed_knots: number | null;
  rhumb_line_distance_nm: number | null;
  rhumb_line_duration_hours: number | null;
  route_advantage_pct: number | null;
  computation_time_ms: number | null;
  legs: Array<{
    from: { lat: number; lng: number; name?: string };
    to: { lat: number; lng: number; name?: string };
    distance_nm: number;
    bearing_deg: number;
    twa_deg: number;
    tws_kts: number;
    boat_speed_kts: number;
    sail_type: string;
    duration_hrs: number;
  }>;
}

// ─── Creation Mode Types ──────────────────────────────────

export type CreationMode = "idle" | "creating" | "editing";
export type InputMode = "map" | "manual";

// ─── Store Interface ──────────────────────────────────────

interface RouteState {
  // Existing state (backward compatible)
  passages: PassageRoute[];
  selectedPassageId: string | null;
  selectedBoatId: string | null;
  departureTime: string;
  computation: RouteComputation | null;
  isComputing: boolean;
  error: string | null;

  // v1.9: Categorized routes
  systemRoutes: PassageRoute[];
  myRoutes: PassageRoute[];
  communityRoutes: PassageRoute[];

  // v1.9: Route creation state
  creationMode: CreationMode;
  inputMode: InputMode;
  editingRouteId: string | null;
  draftWaypoints: Waypoint[];
  draftName: string;
  draftDescription: string;
  draftCourseType: string;
  draftIsPublic: boolean;
  isSaving: boolean;
  saveError: string | null;

  // v1.9: Active view
  activeTab: "routes" | "create" | "results";

  // Existing actions
  setPassages: (passages: PassageRoute[]) => void;
  setSelectedPassage: (id: string | null) => void;
  setSelectedBoat: (id: string | null) => void;
  setDepartureTime: (time: string) => void;
  setComputation: (computation: RouteComputation | null) => void;
  setComputing: (computing: boolean) => void;
  setError: (error: string | null) => void;
  computeRoute: () => Promise<void>;

  // v1.9: Route management actions
  loadRoutes: () => Promise<void>;
  setActiveTab: (tab: "routes" | "create" | "results") => void;

  // v1.9: Creation actions
  startCreating: () => void;
  startEditing: (route: PassageRoute) => void;
  cancelCreation: () => void;
  setInputMode: (mode: InputMode) => void;
  setDraftName: (name: string) => void;
  setDraftDescription: (desc: string) => void;
  setDraftCourseType: (type: string) => void;
  setDraftIsPublic: (isPublic: boolean) => void;
  addWaypoint: (wp: Waypoint) => void;
  updateWaypoint: (index: number, wp: Partial<Waypoint>) => void;
  removeWaypoint: (index: number) => void;
  reorderWaypoints: (from: number, to: number) => void;
  saveRoute: () => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;
  duplicateRoute: (route: PassageRoute) => void;
}

function getDefaultDeparture(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

// ─── Haversine Helper ─────────────────────────────────────

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeTotalDistance(waypoints: Waypoint[]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineNm(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
  }
  return Math.round(total * 10) / 10;
}

export function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

// ─── Store ────────────────────────────────────────────────

export const useRouteStore = create<RouteState>((set, get) => ({
  // Existing state
  passages: [],
  selectedPassageId: null,
  selectedBoatId: null,
  departureTime: getDefaultDeparture(),
  computation: null,
  isComputing: false,
  error: null,

  // v1.9 state
  systemRoutes: [],
  myRoutes: [],
  communityRoutes: [],
  creationMode: "idle",
  inputMode: "map",
  editingRouteId: null,
  draftWaypoints: [],
  draftName: "",
  draftDescription: "",
  draftCourseType: "passage",
  draftIsPublic: false,
  isSaving: false,
  saveError: null,
  activeTab: "routes",

  // ─── Existing Actions (backward compatible) ─────────────

  setPassages: (passages) => {
    const systemRoutes = passages.filter((p) => p.is_system);
    const myRoutes = passages.filter((p) => !p.is_system && p.user_id);
    const communityRoutes = passages.filter((p) => !p.is_system && p.is_public && !p.user_id);
    set({ passages, systemRoutes, myRoutes, communityRoutes });
  },
  setSelectedPassage: (id) => set({ selectedPassageId: id, computation: null, error: null }),
  setSelectedBoat: (id) => set({ selectedBoatId: id, computation: null, error: null }),
  setDepartureTime: (time) => set({ departureTime: time, computation: null, error: null }),
  setComputation: (computation) => set({ computation }),
  setComputing: (computing) => set({ isComputing: computing }),
  setError: (error) => set({ error }),

  computeRoute: async () => {
    const { selectedPassageId, selectedBoatId, departureTime } = get();
    if (!selectedPassageId || !selectedBoatId) {
      set({ error: "Select a passage and boat to compute a route" });
      return;
    }

    set({ isComputing: true, error: null, computation: null });
    try {
      const res = await fetch("/api/route-compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passage_id: selectedPassageId,
          boat_id: selectedBoatId,
          departure_time: departureTime,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Route computation failed (${res.status})`);
      }

      const data = await res.json();
      set({ computation: data.route, isComputing: false, activeTab: "results" });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Route computation failed",
        isComputing: false,
      });
    }
  },

  // ─── v1.9: Route Management ─────────────────────────────

  loadRoutes: async () => {
    try {
      const res = await fetch("/api/routes");
      if (!res.ok) throw new Error("Failed to load routes");
      const data = await res.json();
      set({
        passages: data.routes || [],
        systemRoutes: data.systemRoutes || [],
        myRoutes: data.myRoutes || [],
        communityRoutes: data.communityRoutes || [],
      });
    } catch {
      // Fall back to existing passage loading (backward compatible)
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ─── v1.9: Creation Actions ─────────────────────────────

  startCreating: () =>
    set({
      creationMode: "creating",
      editingRouteId: null,
      draftWaypoints: [],
      draftName: "",
      draftDescription: "",
      draftCourseType: "passage",
      draftIsPublic: false,
      inputMode: "map",
      saveError: null,
      activeTab: "create",
    }),

  startEditing: (route) =>
    set({
      creationMode: "editing",
      editingRouteId: route.id,
      draftWaypoints: [...route.waypoints],
      draftName: route.name,
      draftDescription: route.description || "",
      draftCourseType: route.course_type || "passage",
      draftIsPublic: route.is_public,
      inputMode: "map",
      saveError: null,
      activeTab: "create",
    }),

  cancelCreation: () =>
    set({
      creationMode: "idle",
      editingRouteId: null,
      draftWaypoints: [],
      draftName: "",
      draftDescription: "",
      saveError: null,
      activeTab: "routes",
    }),

  setInputMode: (mode) => set({ inputMode: mode }),
  setDraftName: (name) => set({ draftName: name }),
  setDraftDescription: (desc) => set({ draftDescription: desc }),
  setDraftCourseType: (type) => set({ draftCourseType: type }),
  setDraftIsPublic: (isPublic) => set({ draftIsPublic: isPublic }),

  addWaypoint: (wp) => {
    const { draftWaypoints } = get();
    const newWp: Waypoint = {
      lat: Math.round(wp.lat * 10000) / 10000,
      lng: Math.round(wp.lng * 10000) / 10000,
      name: wp.name || `Waypoint ${draftWaypoints.length + 1}`,
      notes: wp.notes || null,
    };
    set({ draftWaypoints: [...draftWaypoints, newWp], saveError: null });
  },

  updateWaypoint: (index, updates) => {
    const { draftWaypoints } = get();
    const updated = [...draftWaypoints];
    if (index >= 0 && index < updated.length) {
      updated[index] = { ...updated[index], ...updates };
      if (updates.lat !== undefined) updated[index].lat = Math.round(updates.lat * 10000) / 10000;
      if (updates.lng !== undefined) updated[index].lng = Math.round(updates.lng * 10000) / 10000;
    }
    set({ draftWaypoints: updated });
  },

  removeWaypoint: (index) => {
    const { draftWaypoints } = get();
    set({ draftWaypoints: draftWaypoints.filter((_, i) => i !== index) });
  },

  reorderWaypoints: (from, to) => {
    const { draftWaypoints } = get();
    const updated = [...draftWaypoints];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    set({ draftWaypoints: updated });
  },

  saveRoute: async () => {
    const { draftWaypoints, draftName, draftDescription, draftCourseType, draftIsPublic, creationMode, editingRouteId } = get();

    if (!draftName.trim()) {
      set({ saveError: "Route name is required" });
      return;
    }
    if (draftWaypoints.length < 2) {
      set({ saveError: "Add at least 2 waypoints" });
      return;
    }

    set({ isSaving: true, saveError: null });

    try {
      const body = {
        name: draftName.trim(),
        description: draftDescription.trim() || null,
        waypoints: draftWaypoints,
        course_type: draftCourseType,
        is_public: draftIsPublic,
      };

      let res: Response;
      if (creationMode === "editing" && editingRouteId) {
        res = await fetch(`/api/routes/${editingRouteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save route");
      }

      const data = await res.json();

      // Reset creation state and reload routes
      set({
        isSaving: false,
        creationMode: "idle",
        editingRouteId: null,
        draftWaypoints: [],
        draftName: "",
        draftDescription: "",
        saveError: null,
        activeTab: "routes",
        // Select the newly created/edited route
        selectedPassageId: data.route?.id || null,
      });

      // Reload all routes
      await get().loadRoutes();
    } catch (err) {
      set({
        saveError: err instanceof Error ? err.message : "Failed to save route",
        isSaving: false,
      });
    }
  },

  deleteRoute: async (id) => {
    try {
      const res = await fetch(`/api/routes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete route");
      }

      // Clear selection if deleting selected route
      const { selectedPassageId } = get();
      if (selectedPassageId === id) {
        set({ selectedPassageId: null, computation: null });
      }

      // Reload routes
      await get().loadRoutes();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete route" });
    }
  },

  duplicateRoute: (route) => {
    set({
      creationMode: "creating",
      editingRouteId: null,
      draftWaypoints: route.waypoints.map((wp) => ({ ...wp })),
      draftName: `${route.name} (Copy)`,
      draftDescription: route.description || "",
      draftCourseType: route.course_type || "passage",
      draftIsPublic: false,
      inputMode: "map",
      saveError: null,
      activeTab: "create",
    });
  },
}));
