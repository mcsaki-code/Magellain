import { create } from "zustand";
import type { WeatherObservation, MarineForecast, WeatherAlert } from "@/lib/types";

export interface SailingConditions {
  rating: "excellent" | "good" | "fair" | "marginal" | "not_recommended";
  summary: string;
  tips: string[];
  wind_kts: number;
  gust_kts: number;
  wave_ft: number;
  wave_source: "buoy" | "forecast" | "none";
  has_precipitation: boolean;
}

interface WeatherState {
  observations: Record<string, WeatherObservation>;
  forecasts: MarineForecast[];
  alerts: WeatherAlert[];
  sailingConditions: SailingConditions | null;
  selectedStation: string | null;
  isLoading: boolean;
  lastFetched: string | null;
  error: string | null;

  setObservations: (obs: Record<string, WeatherObservation>) => void;
  setForecasts: (forecasts: MarineForecast[]) => void;
  setAlerts: (alerts: WeatherAlert[]) => void;
  setSelectedStation: (stationId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchWeather: () => Promise<void>;
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  observations: {},
  forecasts: [],
  alerts: [],
  sailingConditions: null,
  selectedStation: null,
  isLoading: false,
  lastFetched: null,
  error: null,

  setObservations: (observations) => set({ observations }),
  setForecasts: (forecasts) => set({ forecasts }),
  setAlerts: (alerts) => set({ alerts }),
  setSelectedStation: (stationId) => set({ selectedStation: stationId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  fetchWeather: async () => {
    const state = get();
    if (state.isLoading) return;
    // Don't refetch if data is less than 2 minutes old
    if (state.lastFetched && Date.now() - new Date(state.lastFetched).getTime() < 120_000) return;
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/weather");
      if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
      const data = await res.json();
      set({
        observations: data.observations ?? {},
        forecasts: data.forecasts ?? [],
        alerts: data.alerts ?? [],
        sailingConditions: data.sailingConditions ?? null,
        lastFetched: new Date().toISOString(),
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch weather",
        isLoading: false,
      });
    }
  },
}));
