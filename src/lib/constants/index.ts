// ─── Geography ───────────────────────────────────────────────────────
export const FORD_YC = {
  lat: 42.0904,
  lng: -83.1713,
  name: "Ford Yacht Club",
  shortName: "FYC",
} as const;

// Center slightly south of FYC to show W. Lake Erie buoys + Detroit River area
export const DEFAULT_MAP_CENTER: [number, number] = [-83.0, 41.9];
export const DEFAULT_MAP_ZOOM = 9;

// ─── NDBC Buoy Stations ─────────────────────────────────────────────
// Ordered nearest → farthest from Ford Yacht Club (Grosse Ile, 42.09°N 83.17°W).
//
// NOTE: No NDBC buoy exists IN the Detroit River — rivers don't have offshore
// buoys. The two closest real-time wind stations are at the Detroit River mouth:
//   THRO1 (Toledo Harbor C-MAN, ~35 nm S) and 45132 (Toledo Channel Light, ~35 nm S).
// These are the best proxies for Detroit River race conditions.
// All lake buoys are seasonal (deployed ~Apr–Nov by GLERL/NOAA).
export const BUOY_STATIONS = [
  // ── Detroit River mouth / western basin — best for FYC racing ─────
  { id: "THRO1", name: "Toledo Harbor",        lat: 41.694, lng: -83.473 }, // C-MAN, year-round
  { id: "45132", name: "Toledo Channel Light", lat: 41.694, lng: -83.194 }, // seasonal buoy
  // ── Western Lake Erie open water ─────────────────────────────────
  { id: "45005", name: "W Lake Erie Buoy",     lat: 41.677, lng: -82.398 }, // seasonal
  { id: "SBIO1", name: "South Bass Island",    lat: 41.629, lng: -82.841 }, // C-MAN, year-round
  // ── Central / eastern reference ──────────────────────────────────
  { id: "MRHO1", name: "Marblehead, OH",       lat: 41.544, lng: -82.731 }, // C-MAN, year-round
  { id: "45142", name: "Cleveland Buoy",       lat: 41.589, lng: -81.575 }, // seasonal
] as const;

// ─── NWS Marine Forecast Zones ──────────────────────────────────────
// LEZ045 covers the Detroit River / Lake St. Clair corridor (most relevant for FYC).
// Western Lake Erie zones provide open-water conditions.
export const MARINE_ZONES = [
  { id: "LEZ045", name: "Detroit River / Lake St. Clair" },  // primary FYC racing zone
  { id: "LEZ142", name: "Maumee Bay to Reno Beach" },
  { id: "LEZ143", name: "Reno Beach to The Islands" },
  { id: "LEZ162", name: "W Lake Erie open water" },
] as const;

// ─── Clubs ───────────────────────────────────────────────────────────
export const CLUBS = [
  {
    id: "ford-yc",
    name: "Ford Yacht Club",
    shortName: "FYC",
    lat: 42.0904,
    lng: -83.1713,
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
  { key: "route", label: "Route", href: "/route-planner" },
  { key: "weather", label: "Weather", href: "/weather" },
  { key: "chat", label: "Coach", href: "/chat" },
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
