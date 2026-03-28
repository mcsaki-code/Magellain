import { create } from "zustand";

export interface PassageRoute {
  id: string;
  name: string;
  description: string | null;
  departure_name: string;
  departure_lat: number;
  departure_lng: number;
  arrival_name: string;
  arrival_lat: number;
  arrival_lng: number;
  waypoints: Array<{ lat: number; lng: number; name?: string }>;
  rhumb_line_distance_nm: number | null;
  difficulty: string | null;
  course_type: string | null;
  region: string | null;
  is_system: boolean;
  is_public: boolean;
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

interface RouteState {
  passages: PassageRoute[];
  selectedPassageId: string | null;
  selectedBoatId: string | null;
  departureTime: string;
  computation: RouteComputation | null;
  isComputing: boolean;
  error: string | null;

  setPassages: (passages: PassageRoute[]) => void;
  setSelectedPassage: (id: string | null) => void;
  setSelectedBoat: (id: string | null) => void;
  setDepartureTime: (time: string) => void;
  setComputation: (computation: RouteComputation | null) => void;
  setComputing: (computing: boolean) => void;
  setError: (error: string | null) => void;
  computeRoute: () => Promise<void>;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  passages: [],
  selectedPassageId: null,
  selectedBoatId: null,
  departureTime: getDefaultDeparture(),
  computation: null,
  isComputing: false,
  error: null,

  setPassages: (passages) => set({ passages }),
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
      set({ computation: data.route, isComputing: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Route computation failed",
        isComputing: false,
      });
    }
  },
}));

function getDefaultDeparture(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

