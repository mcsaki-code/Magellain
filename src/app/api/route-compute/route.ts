import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { passage_id, boat_id, departure_time } = body;

    if (!passage_id || !boat_id) {
      return NextResponse.json(
        { error: "passage_id and boat_id are required" },
        { status: 400 }
      );
    }

    // Fetch passage details
    const { data: passage, error: passageError } = await supabase
      .from("passage_routes")
      .select("*")
      .eq("id", passage_id)
      .single();

    if (passageError || !passage) {
      return NextResponse.json({ error: "Passage not found" }, { status: 404 });
    }

    // Fetch boat details
    const { data: boat, error: boatError } = await supabase
      .from("boats")
      .select("*")
      .eq("id", boat_id)
      .single();

    if (boatError || !boat) {
      return NextResponse.json({ error: "Boat not found" }, { status: 404 });
    }

    // Fetch polar data for this boat (actual columns: twa_degrees, tws_knots, boat_speed_knots)
    const { data: polars } = await supabase
      .from("boat_polars")
      .select("twa_degrees, tws_knots, boat_speed_knots, sail_type")
      .eq("boat_id", boat_id)
      .order("twa_degrees")
      .order("tws_knots");

    if (!polars || polars.length === 0) {
      return NextResponse.json(
        { error: `No polar data available for ${boat.name}. PHRF rating required.` },
        { status: 400 }
      );
    }

    // Fetch latest weather observations
    const { data: weatherObs } = await supabase
      .from("weather_observations")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(20);

    // Fetch weather stations for position data
    const { data: stations } = await supabase
      .from("weather_stations")
      .select("station_id, name, lat, lng")
      .eq("is_active", true);

    // Build waypoints from passage
    const waypoints = (passage.waypoints as Array<{ lat: number; lng: number; name?: string }>) || [];
    const departureCoord = {
      lat: Number(passage.departure_lat) ?? waypoints[0]?.lat,
      lng: Number(passage.departure_lng) ?? waypoints[0]?.lng,
    };
    const arrivalCoord = {
      lat: Number(passage.arrival_lat) ?? waypoints[waypoints.length - 1]?.lat,
      lng: Number(passage.arrival_lng) ?? waypoints[waypoints.length - 1]?.lng,
    };

    // Build the full route point list
    const routePoints = [departureCoord, ...waypoints, arrivalCoord];

    // Compute route using polar interpolation
    const depTime = new Date(departure_time || new Date().toISOString());
    const computeStart = Date.now();
    const legs = computeLegs(routePoints, polars, weatherObs || [], stations || []);
    const computeTimeMs = Date.now() - computeStart;

    const totalDistance = legs.reduce((sum, l) => sum + l.distance_nm, 0);
    const totalDuration = legs.reduce((sum, l) => sum + l.duration_hrs, 0);
    const avgSpeed = totalDuration > 0 ? totalDistance / totalDuration : 0;
    const maxSpeed = Math.max(...legs.map((l) => l.boat_speed_kts));
    const arrivalTime = new Date(depTime.getTime() + totalDuration * 3600000);

    // Build GeoJSON route
    const coordinates = routePoints.map((p) => [p.lng, p.lat]);
    const optimalRoute = {
      type: "LineString" as const,
      coordinates,
    };

    // Determine sail changes
    const sailChanges: Array<{
      leg: number;
      from_sail: string;
      to_sail: string;
      reason: string;
    }> = [];
    for (let i = 1; i < legs.length; i++) {
      if (legs[i].sail_type !== legs[i - 1].sail_type) {
        sailChanges.push({
          leg: i,
          from_sail: legs[i - 1].sail_type,
          to_sail: legs[i].sail_type,
          reason: `TWA ${Math.round(legs[i - 1].twa_deg)}° → ${Math.round(legs[i].twa_deg)}°`,
        });
      }
    }

    // Risk assessment
    const maxWind = Math.max(...legs.map((l) => l.tws_kts));
    const riskFactors: string[] = [];
    let riskLevel: "low" | "moderate" | "high" | "extreme" = "low";
    if (maxWind > 30) {
      riskLevel = "extreme";
      riskFactors.push(`Gale force winds expected (${Math.round(maxWind)} kts)`);
    } else if (maxWind > 25) {
      riskLevel = "high";
      riskFactors.push(`Strong winds expected (${Math.round(maxWind)} kts)`);
    } else if (maxWind > 18) {
      riskLevel = "moderate";
      riskFactors.push(`Fresh to strong breeze (${Math.round(maxWind)} kts)`);
    }
    if (totalDuration > 24) {
      riskFactors.push(`Long passage: ${Math.round(totalDuration)}h — crew fatigue management needed`);
      if (riskLevel === "low") riskLevel = "moderate";
    }
    if (legs.some((l) => l.twa_deg < 35)) {
      riskFactors.push("Heavy upwind work on some legs");
    }

    // Rhumb line comparison
    const rhumbDistance = haversineNm(
      departureCoord.lat,
      departureCoord.lng,
      arrivalCoord.lat,
      arrivalCoord.lng
    );
    const rhumbDuration = avgSpeed > 0 ? rhumbDistance / avgSpeed : null;
    const routeAdvantage = rhumbDuration && totalDuration > 0
      ? Math.round(((rhumbDuration - totalDuration) / rhumbDuration) * 100)
      : null;

    // Recommended sails (unique sails used)
    const recommendedSails = Array.from(new Set(legs.map((l) => l.sail_type)));

    // Store the computation (using actual DB column names)
    const { data: stored, error: storeError } = await supabase
      .from("route_computations")
      .insert({
        passage_id,
        boat_id,
        user_id: user.id,
        departure_time: depTime.toISOString(),
        status: "complete",
        computed_at: new Date().toISOString(),
        computation_time_ms: computeTimeMs,
        optimal_route: optimalRoute,
        total_distance_nm: Math.round(totalDistance * 10) / 10,
        estimated_duration_hours: Math.round(totalDuration * 10) / 10,
        estimated_arrival: arrivalTime.toISOString(),
        avg_speed_knots: Math.round(avgSpeed * 100) / 100,
        max_speed_knots: Math.round(maxSpeed * 100) / 100,
        sail_changes: sailChanges,
        recommended_sails: recommendedSails,
        rhumb_line_distance_nm: Math.round(rhumbDistance * 10) / 10,
        rhumb_line_duration_hours: rhumbDuration ? Math.round(rhumbDuration * 10) / 10 : null,
        route_advantage_pct: routeAdvantage,
        route_advantage_hours: rhumbDuration && totalDuration
          ? Math.round((rhumbDuration - totalDuration) * 10) / 10
          : null,
        weather_summary: {
          observations_used: (weatherObs || []).length,
          stations_available: (stations || []).length,
          fetched_at: new Date().toISOString(),
        },
        forecast_source: "ndbc_realtime",
        risk_level: riskLevel,
        risk_factors: riskFactors,
        legs,
      })
      .select()
      .single();

    if (storeError) {
      console.error("Failed to store route computation:", storeError);
    }

    // Build response using consistent field names for the frontend
    const route = {
      id: stored?.id ?? crypto.randomUUID(),
      passage_id,
      boat_id,
      departure_time: depTime.toISOString(),
      estimated_arrival: arrivalTime.toISOString(),
      status: "complete" as const,
      optimal_route: optimalRoute,
      weather_data: {
        observations_used: (weatherObs || []).length,
        stations_available: (stations || []).length,
      },
      sail_changes: sailChanges,
      recommended_sails: recommendedSails,
      risk_level: riskLevel,
      risk_factors: riskFactors,
      total_distance_nm: Math.round(totalDistance * 10) / 10,
      estimated_duration_hours: Math.round(totalDuration * 10) / 10,
      avg_speed_knots: Math.round(avgSpeed * 100) / 100,
      max_speed_knots: Math.round(maxSpeed * 100) / 100,
      rhumb_line_distance_nm: Math.round(rhumbDistance * 10) / 10,
      rhumb_line_duration_hours: rhumbDuration ? Math.round(rhumbDuration * 10) / 10 : null,
      route_advantage_pct: routeAdvantage,
      computation_time_ms: computeTimeMs,
      legs,
    };

    return NextResponse.json({ route, passage, boat });
  } catch (err) {
    console.error("Route compute error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Polar Interpolation ─────────────────────────────────────────────

function interpolatePolar(
  polars: Array<{ twa_degrees: number; tws_knots: number; boat_speed_knots: number; sail_type: string }>,
  twa: number,
  tws: number
): { speed: number; sail: string } {
  // Get unique sorted TWA and TWS values
  const twas = Array.from(new Set(polars.map((p) => Number(p.twa_degrees)))).sort((a, b) => a - b);
  const twss = Array.from(new Set(polars.map((p) => Number(p.tws_knots)))).sort((a, b) => a - b);

  // Clamp to available range
  const clampedTwa = Math.max(twas[0], Math.min(twas[twas.length - 1], twa));
  const clampedTws = Math.max(twss[0], Math.min(twss[twss.length - 1], tws));

  // Find bracketing indices
  let twaLow = twas[0], twaHigh = twas[twas.length - 1];
  for (let i = 0; i < twas.length - 1; i++) {
    if (twas[i] <= clampedTwa && twas[i + 1] >= clampedTwa) {
      twaLow = twas[i];
      twaHigh = twas[i + 1];
      break;
    }
  }

  let twsLow = twss[0], twsHigh = twss[twss.length - 1];
  for (let i = 0; i < twss.length - 1; i++) {
    if (twss[i] <= clampedTws && twss[i + 1] >= clampedTws) {
      twsLow = twss[i];
      twsHigh = twss[i + 1];
      break;
    }
  }

  // Get the 4 corner values
  const find = (ta: number, ts: number) =>
    polars.find((p) => Number(p.twa_degrees) === ta && Number(p.tws_knots) === ts);

  const q11 = find(twaLow, twsLow);
  const q12 = find(twaLow, twsHigh);
  const q21 = find(twaHigh, twsLow);
  const q22 = find(twaHigh, twsHigh);

  if (!q11) return { speed: 0, sail: "main+jib" };

  // Bilinear interpolation
  const twaRange = twaHigh - twaLow || 1;
  const twsRange = twsHigh - twsLow || 1;
  const twaFrac = (clampedTwa - twaLow) / twaRange;
  const twsFrac = (clampedTws - twsLow) / twsRange;

  const s11 = Number(q11?.boat_speed_knots ?? 0);
  const s12 = Number(q12?.boat_speed_knots ?? s11);
  const s21 = Number(q21?.boat_speed_knots ?? s11);
  const s22 = Number(q22?.boat_speed_knots ?? s12);

  const speed =
    s11 * (1 - twaFrac) * (1 - twsFrac) +
    s21 * twaFrac * (1 - twsFrac) +
    s12 * (1 - twaFrac) * twsFrac +
    s22 * twaFrac * twsFrac;

  // Pick sail from closest corner
  const closestCorner = [q11, q12, q21, q22].filter(Boolean).sort(
    (a, b) =>
      Math.abs(Number(a!.twa_degrees) - clampedTwa) + Math.abs(Number(a!.tws_knots) - clampedTws) -
      (Math.abs(Number(b!.twa_degrees) - clampedTwa) + Math.abs(Number(b!.tws_knots) - clampedTws))
  )[0];

  return { speed: Math.round(speed * 100) / 100, sail: closestCorner?.sail_type ?? "main+jib" };
}

// ─── Wind Estimation ─────────────────────────────────────────────────

function estimateWind(
  lat: number,
  lng: number,
  observations: Array<Record<string, unknown>>,
  stations: Array<{ station_id: string; lat: number; lng: number }>
): { speed: number; direction: number } {
  let bestObs: Record<string, unknown> | null = null;
  let bestDist = Infinity;

  for (const station of stations) {
    const dist = haversineNm(lat, lng, Number(station.lat), Number(station.lng));
    if (dist > 50) continue;

    const obs = observations.find(
      (o) => o.station_id === station.station_id && o.wind_speed_kts != null
    );
    if (obs && dist < bestDist) {
      bestObs = obs;
      bestDist = dist;
    }
  }

  if (bestObs) {
    return {
      speed: Number(bestObs.wind_speed_kts) || 10,
      direction: Number(bestObs.wind_direction_deg) || 220,
    };
  }

  // Fallback: SW 10kts (typical Lake Erie prevailing wind)
  return { speed: 10, direction: 220 };
}

// ─── Leg Computation ─────────────────────────────────────────────────

function computeLegs(
  points: Array<{ lat: number; lng: number; name?: string }>,
  polars: Array<{ twa_degrees: number; tws_knots: number; boat_speed_knots: number; sail_type: string }>,
  observations: Array<Record<string, unknown>>,
  stations: Array<{ station_id: string; lat: number; lng: number }>
) {
  const legs: Array<{
    from: { lat: number; lng: number; name?: string };
    to: { lat: number; lng: number; name?: string };
    distance_nm: number;
    bearing_deg: number;
    twa_deg: number;
    tws_kts: number;
    boat_speed_kts: number;
    sail_type: string;
    duration_hrs: number;
  }> = [];

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];

    const distance = haversineNm(from.lat, from.lng, to.lat, to.lng);
    const bearing = initialBearing(from.lat, from.lng, to.lat, to.lng);

    // Estimate wind at midpoint of leg
    const midLat = (from.lat + to.lat) / 2;
    const midLng = (from.lng + to.lng) / 2;
    const wind = estimateWind(midLat, midLng, observations, stations);

    // Calculate true wind angle relative to boat heading
    let twa = Math.abs(wind.direction - bearing);
    if (twa > 180) twa = 360 - twa;

    // VMG optimization for close-hauled (can't sail closer than ~30°)
    let effectiveTwa = twa;
    let effectiveDistance = distance;
    if (twa < 30) {
      effectiveTwa = 42;
      effectiveDistance = distance / Math.cos((42 - twa) * (Math.PI / 180));
    }

    // Interpolate polar for boat speed
    const polar = interpolatePolar(polars, effectiveTwa, wind.speed);
    const boatSpeed = Math.max(polar.speed, 0.5); // minimum drift speed
    const duration = effectiveDistance / boatSpeed;

    legs.push({
      from,
      to,
      distance_nm: Math.round(distance * 10) / 10,
      bearing_deg: Math.round(bearing),
      twa_deg: Math.round(effectiveTwa),
      tws_kts: Math.round(wind.speed * 10) / 10,
      boat_speed_kts: boatSpeed,
      sail_type: polar.sail,
      duration_hrs: Math.round(duration * 100) / 100,
    });
  }

  return legs;
}

// ─── Geo Utilities ───────────────────────────────────────────────────

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function initialBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
