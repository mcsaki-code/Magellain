export type * from "./database";

// ─── App-level types ─────────────────────────────────────────────────

export type NavItem = {
  key: string;
  label: string;
  href: string;
};

export type WindData = {
  speed: number;
  direction: number;
  gust: number | null;
};

export type MapViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

export type BuoyPanelData = {
  stationId: string;
  stationName: string;
  observation: {
    windSpeed: number | null;
    windDirection: number | null;
    windGust: number | null;
    waveHeight: number | null;
    wavePeriod: number | null;
    airTemp: number | null;
    waterTemp: number | null;
    pressure: number | null;
    observedAt: string;
  } | null;
};

export type ThemeMode = "light" | "dark" | "system";
