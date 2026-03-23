import { NextResponse } from "next/server";
import { BUOY_STATIONS, MARINE_ZONES } from "@/lib/constants";

// Force dynamic — never statically render this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── NDBC Observation Parser ────────────────────────────────────────
function parseNdbcObservation(text: string, stationId: string) {
  const lines = text.trim().split("\n");
  if (lines.length < 3) return null;

  // NDBC files have 2 header lines starting with #, then data lines
  // Line 0 = #header names, Line 1 = #units, Line 2+ = data
  const headers = lines[0].replace(/^#\s*/, "").trim().split(/\s+/);
  // Find first non-comment line
  const dataLineIdx = lines.findIndex((l, i) => i > 0 && !l.startsWith("#"));
  if (dataLineIdx < 0) return null;
  const values = lines[dataLineIdx].trim().split(/\s+/);

  const get = (name: string): number | null => {
    const idx = headers.indexOf(name);
    if (idx < 0 || !values[idx] || values[idx] === "MM") return null;
    const raw = values[idx];
    const v = parseFloat(raw);
    if (isNaN(v)) return null;
    // NDBC sentinel values depend on the field:
    // Temp fields (ATMP, WTMP, DEWP): 999 or 99.0 means missing
    // Wind/direction: 99 or 999 means missing
    // Pressure: 9999 means missing (valid range ~900-1100 mb)
    // Wave: 99.0 or 99.00 means missing
    // Visibility: 99.0 means missing
    // General: any field that is exactly "99.0", "99.00", "999", "999.0", or "9999" is missing
    if (raw === "99.0" || raw === "99.00" || raw === "999" || raw === "999.0" || raw === "9999" || raw === "9999.0") return null;
    return v;
  };

  // Convert m/s to knots (1 m/s = 1.94384 knots)
  const msToKts = (ms: number | null) => (ms !== null ? Math.round(ms * 1.94384 * 10) / 10 : null);
  // Convert Celsius to Fahrenheit
  const cToF = (c: number | null) => (c !== null ? Math.round((c * 9) / 5 + 32) : null);
  // Convert meters to feet
  const mToFt = (m: number | null) => (m !== null ? Math.round(m * 3.28084 * 10) / 10 : null);

  const year = values[0];
  const month = values[1]?.padStart(2, "0");
  const day = values[2]?.padStart(2, "0");
  const hour = values[3]?.padStart(2, "0");
  const min = values[4]?.padStart(2, "0");

  return {
    station_id: stationId,
    observed_at: `${year}-${month}-${day}T${hour}:${min}:00Z`,
    wind_speed_kts: msToKts(get("WSPD")),
    wind_direction_deg: get("WDIR"),
    wind_gust_kts: msToKts(get("GST")),
    wave_height_ft: mToFt(get("WVHT")),
    wave_period_sec: get("DPD"),
    wave_direction_deg: get("MWD"),
    air_temp_f: cToF(get("ATMP")),
    water_temp_f: cToF(get("WTMP")),
    barometric_pressure_mb: get("PRES"),
    visibility_nm: get("VIS"),
    dewpoint_f: cToF(get("DEWP")),
    humidity_pct: null as number | null,
  };
}

// ─── Fetch NDBC Station Data ────────────────────────────────────────
async function fetchNdbcStation(stationId: string) {
  try {
    const url = `https://www.ndbc.noaa.gov/data/realtime2/${stationId}.txt`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return parseNdbcObservation(text, stationId);
  } catch {
    console.error(`Failed to fetch NDBC station ${stationId}`);
    return null;
  }
}

// ─── Fetch NWS Marine Forecast ──────────────────────────────────────
async function fetchMarineForecasts() {
  const forecasts = [];
  for (const zone of MARINE_ZONES) {
    try {
      const url = `https://api.weather.gov/zones/marine/${zone.id}/forecast`;
      const res = await fetch(url, {
        headers: { "User-Agent": "(MagellAIn, mattcsaki@gmail.com)" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const periods = data.properties?.periods ?? [];
      for (const period of periods.slice(0, 3)) {
        const forecastText = period.detailedForecast ?? period.text ?? "";

        // Parse wave height from forecast text (e.g. "waves 2 to 4 feet", "seas 1 to 3 ft")
        const waveMatch = forecastText.match(/(?:waves?|seas?)\s+(\d+)\s+(?:to\s+)?(\d+)?\s*(?:feet|ft)/i);
        const waveMin = waveMatch ? parseInt(waveMatch[1]) : null;
        const waveMax = waveMatch ? parseInt(waveMatch[2] ?? waveMatch[1]) : null;

        // Parse wind from forecast text (e.g. "winds 10 to 15 knots", "north winds 5 to 10 kt")
        const windMatch = forecastText.match(/(?:(\w+)\s+)?winds?\s+(\d+)\s+(?:to\s+)?(\d+)?\s*(?:knots?|kts?|kt)/i);
        const windDir = windMatch?.[1] ?? null;
        const windMin = windMatch ? parseInt(windMatch[2]) : null;
        const windMax = windMatch ? parseInt(windMatch[3] ?? windMatch[2]) : null;

        // Check for precipitation keywords
        const hasPrecip = /rain|showers?|thunderstorm|snow|sleet|drizzle|precipitation/i.test(forecastText);

        forecasts.push({
          zone_id: zone.id,
          zone_name: zone.name,
          period_name: period.name ?? "Unknown",
          forecast_text: forecastText,
          hazards: [] as string[],
          wind_speed_min_kts: windMin,
          wind_speed_max_kts: windMax,
          wind_direction: windDir,
          wave_height_min_ft: waveMin,
          wave_height_max_ft: waveMax,
          has_precipitation: hasPrecip,
          issued_at: data.properties?.updated ?? new Date().toISOString(),
          expires_at: null as string | null,
        });
      }
    } catch {
      console.error(`Failed to fetch forecast for zone ${zone.id}`);
    }
  }
  return forecasts;
}

// ─── Fetch NWS Alerts ───────────────────────────────────────────────
async function fetchWeatherAlerts() {
  try {
    // Lake Erie area alerts
    const url = "https://api.weather.gov/alerts/active?area=OH,MI,NY,PA&event=Marine";
    const res = await fetch(url, {
      headers: { "User-Agent": "(MagellAIn, mattcsaki@gmail.com)" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).slice(0, 10).map((f: Record<string, unknown>) => {
      const props = f.properties as Record<string, unknown>;
      return {
        alert_id: props.id as string,
        event_type: props.event as string,
        severity: ((props.severity as string) ?? "minor").toLowerCase(),
        urgency: ((props.urgency as string) ?? "unknown").toLowerCase(),
        headline: props.headline as string,
        description: props.description as string,
        instruction: props.instruction as string | null,
        affected_zones: (props.affectedZones as string[]) ?? [],
        onset: props.onset as string | null,
        expires: props.expires as string | null,
      };
    });
  } catch {
    console.error("Failed to fetch weather alerts");
    return [];
  }
}

// ─── Sailing Conditions Analyzer ────────────────────────────────────
function analyzeSailingConditions(
  obsMap: Record<string, ReturnType<typeof parseNdbcObservation>>,
  forecasts: Array<Record<string, unknown>>,
  alerts: Array<Record<string, unknown>>
) {
  // Find best observation with wind data
  const obsValues = Object.values(obsMap).filter(Boolean);
  const windObs = obsValues.find((o) => o?.wind_speed_kts != null);
  const wind = windObs?.wind_speed_kts ?? 0;
  const gust = windObs?.wind_gust_kts ?? 0;
  const waveObs = obsValues.find((o) => o?.wave_height_ft != null);
  const airTemp = obsValues.find((o) => o?.air_temp_f != null)?.air_temp_f;

  // Use NWS forecast wave data as fallback when no buoy reports waves
  let waves = waveObs?.wave_height_ft ?? 0;
  let waveSource: "buoy" | "forecast" | "none" = waveObs ? "buoy" : "none";
  if (!waveObs) {
    const waveForecast = forecasts.find((f) => (f.wave_height_max_ft as number | null) != null);
    if (waveForecast) {
      const maxWave = waveForecast.wave_height_max_ft as number;
      const minWave = (waveForecast.wave_height_min_ft as number) ?? maxWave;
      waves = Math.round(((minWave + maxWave) / 2) * 10) / 10;
      waveSource = "forecast";
    }
  }

  // Check forecasts for precipitation
  const hasPrecip = forecasts.some((f) => f.has_precipitation);
  const hasAlerts = alerts.length > 0;

  // Determine sailing rating
  let rating: "excellent" | "good" | "fair" | "marginal" | "not_recommended" = "good";
  let summary = "";
  const tips: string[] = [];

  if (hasAlerts || gust > 35 || wind > 30 || waves > 6) {
    rating = "not_recommended";
    summary = "Conditions are dangerous for sailing. Stay onshore.";
    if (hasAlerts) tips.push("Active marine weather alerts in effect");
    if (gust > 35) tips.push(`Strong gusts to ${gust} kts`);
    if (waves > 6) tips.push(`Heavy seas at ${waves} ft`);
  } else if (gust > 25 || wind > 20 || waves > 4) {
    rating = "marginal";
    summary = "Experienced sailors only. Reef early and stay alert.";
    if (wind > 20) tips.push(`Strong winds at ${wind} kts — reef main and consider smaller headsail`);
    if (waves > 4) tips.push(`Significant wave height ${waves} ft`);
    if (hasPrecip) tips.push("Precipitation in forecast — reduced visibility");
  } else if (wind > 15 || waves > 2.5) {
    rating = "fair";
    summary = "Solid sailing breeze. Good conditions for racing.";
    if (wind > 15) tips.push(`Fresh breeze at ${wind} kts — full sail or light reef depending on boat`);
    tips.push("Good racing conditions for most fleets");
    if (hasPrecip) tips.push("Watch for rain reducing visibility");
  } else if (wind >= 8) {
    rating = "excellent";
    summary = "Ideal sailing conditions. Perfect for all skill levels.";
    tips.push(`Moderate ${wind} kt breeze — full sail conditions`);
    if (waves < 2) tips.push("Flat to light chop — comfortable sailing");
  } else if (wind >= 4) {
    rating = "good";
    summary = "Light air sailing. Good for practice and casual sailing.";
    tips.push(`Light winds at ${wind} kts — use light-air sails if available`);
    tips.push("Focus on sail trim and weight placement");
  } else {
    rating = "fair";
    summary = "Very light winds. Drifting conditions possible.";
    tips.push("Minimal wind — patience required");
    tips.push("Keep weight low and forward, minimize movement");
  }

  if (airTemp != null && airTemp < 45) {
    tips.push(`Cold conditions at ${airTemp}\u00B0F — dress in layers, wear drysuit or foul weather gear`);
  }

  // Note the wave data source
  if (waveSource === "forecast") {
    const waveForecast = forecasts.find((f) => (f.wave_height_max_ft as number | null) != null);
    if (waveForecast) {
      tips.push(`Wave data from NWS marine forecast (${waveForecast.wave_height_min_ft}-${waveForecast.wave_height_max_ft} ft)`);
    }
  } else if (waveSource === "none") {
    tips.push("No wave data available — offshore buoys deploy in spring");
  }

  return { rating, summary, tips, wind_kts: wind, gust_kts: gust, wave_ft: waves, wave_source: waveSource, has_precipitation: hasPrecip };
}

// ─── API Route Handler ──────────────────────────────────────────────
export async function GET() {
  try {
    // Fetch all data sources in parallel
    const [observations, forecasts, alerts] = await Promise.all([
      Promise.all(BUOY_STATIONS.map((s) => fetchNdbcStation(s.id))),
      fetchMarineForecasts(),
      fetchWeatherAlerts(),
    ]);

    // Build observations map keyed by station ID
    const obsMap: Record<string, ReturnType<typeof parseNdbcObservation>> = {};
    BUOY_STATIONS.forEach((station, i) => {
      if (observations[i]) {
        obsMap[station.id] = observations[i];
      }
    });

    // Generate sailing conditions analysis
    const sailingConditions = analyzeSailingConditions(
      obsMap,
      forecasts as Array<Record<string, unknown>>,
      alerts as Array<Record<string, unknown>>
    );

    return NextResponse.json({
      observations: obsMap,
      forecasts,
      alerts,
      sailingConditions,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Weather API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}
