// ─── Geography ───────────────────────────────────────────────────────
export const FORD_YC = {
  lat: 42.1244,
  lng: -83.1333,
  name: "Ford Yacht Club",
  shortName: "FYC",
} as const;

export const DEFAULT_MAP_CENTER: [number, number] = [FORD_YC.lng, FORD_YC.lat];
export const DEFAULT_MAP_ZOOM = 11;

// ─── NDBC Buoy Stations ─────────────────────────────────────────────
// Mix of C-MAN shore stations (year-round) and offshore buoys (seasonal)
// Shore stations listed first — they're more reliable in early season
export const BUOY_STATIONS = [
  { id: "MRHO1", name: "Marblehead, OH", lat: 41.544, lng: -82.731 },
  { id: "SBIO1", name: "South Bass Island, OH", lat: 41.629, lng: -82.841 },
  { id: "THRO1", name: "Toledo Harbor, OH", lat: 41.694, lng: -83.473 },
  { id: "DBLN6", name: "Dunkirk, NY", lat: 42.494, lng: -79.354 },
  { id: "45005", name: "W Lake Erie (buoy)", lat: 41.677, lng: -82.398 },
  { id: "45132", name: "Toledo Channel LS", lat: 41.694, lng: -83.194 },
  { id: "45142", name: "Cleveland (buoy)", lat: 41.589, lng: -81.575 },
] as const;

// ─── NWS Marine Forecast Zones ──────────────────────────────────────
export const MARINE_ZONES = [
  { id: "LEZ142", name: "Maumee Bay to Reno Beach" },
  { id: "LEZ143", name: "Reno Beach to The Islands" },
  { id: "LEZ144", name: "The Islands to Vermilion" },
  { id: "LEZ162", name: "Open waters west of Avon Point" },
  { id: "LEZ163", name: "Open waters Avon Pt to Conneaut" },
] as const;

// ─── Clubs ───────────────────────────────────────────────────────────
export const CLUBS = [
  {
    id: "ford-yc",
    name: "Ford Yacht Club",
    shortName: "FYC",
    lat: 42.1244,
    lng: -83.1333,
    website: "https://www.fordyachtclub.com",
  },
  {
    id: "wssc",
    name: "West Shore Sail Club",
    shortName: "WSSC",
    lat: 42.0965,
    lng: -83.1862,
    website: "https://westshoresailclub.org",
  },
] as const;

// ─── Data Refresh ────────────────────────────────────────────────────
export const WEATHER_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const FORECAST_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ─── UI ──────────────────────────────────────────────────────────────
export const NAV_ITEMS = [
  { key: "map", label: "Map", href: "/map" },
  { key: "weather", label: "Weather", href: "/weather" },
  { key: "chat", label: "Coach", href: "/chat" },
  { key: "messages", label: "Crew", href: "/messages" },
  { key: "races", label: "Races", href: "/races" },
  { key: "menu", label: "Menu", href: "/menu" },
] as const;

// ─── Wind Speed Ranges (knots) for color coding ─────────────────────
export const WIND_COLORS = {
  calm: { max: 5, color: "#60A5FA", label: "Calm" },
  light: { max: 10, color: "#34D399", label: "Light" },
  moderate: { max: 15, color: "#FBBF24", label: "Moderate" },
  fresh: { max: 20, color: "#F97316", label: "Fresh" },
  strong: { max: 25, color: "#EF4444", label: "Strong" },
  gale: { max: Infinity, color: "#DC2626", label: "Gale" },
} as const;

export function getWindColor(speedKnots: number): string {
  if (speedKnots <= WIND_COLORS.calm.max) return WIND_COLORS.calm.color;
  if (speedKnots <= WIND_COLORS.light.max) return WIND_COLORS.light.color;
  if (speedKnots <= WIND_COLORS.moderate.max) return WIND_COLORS.moderate.color;
  if (speedKnots <= WIND_COLORS.fresh.max) return WIND_COLORS.fresh.color;
  if (speedKnots <= WIND_COLORS.strong.max) return WIND_COLORS.strong.color;
  return WIND_COLORS.gale.color;
}
