import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Max routes per user
const MAX_USER_ROUTES = 50;

// Great Lakes bounding box for validation
const BOUNDS = {
  latMin: 41.0,
  latMax: 49.0,
  lngMin: -93.0,
  lngMax: -76.0,
};

function validateWaypoint(wp: any): boolean {
  if (!wp || typeof wp.lat !== "number" || typeof wp.lng !== "number") return false;
  if (wp.lat < BOUNDS.latMin || wp.lat > BOUNDS.latMax) return false;
  if (wp.lng < BOUNDS.lngMin || wp.lng > BOUNDS.lngMax) return false;
  return true;
}

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeRhumbDistance(waypoints: Array<{ lat: number; lng: number }>): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineNm(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
  }
  return Math.round(total * 10) / 10;
}

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as any);
            });
          } catch {
            // Server component — ignore
          }
        },
      },
    }
  );
}

// ─── GET /api/routes ──────────────────────────────────────
// Returns all routes the user can see (system + public + own)
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // RLS handles filtering: system + public + own
    const { data, error } = await supabase
      .from("passage_routes")
      .select("*")
      .order("is_system", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Separate into categories for the frontend
    const systemRoutes = (data || []).filter((r: any) => r.is_system);
    const communityRoutes = (data || []).filter((r: any) => !r.is_system && r.is_public && r.user_id !== user?.id);
    const myRoutes = user
      ? (data || []).filter((r: any) => r.user_id === user.id)
      : [];

    return NextResponse.json({
      routes: data || [],
      systemRoutes,
      communityRoutes,
      myRoutes,
      total: data?.length || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch routes" },
      { status: 500 }
    );
  }
}

// ─── POST /api/routes ─────────────────────────────────────
// Create a new user route
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in to create routes" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, waypoints, course_type, region, difficulty, is_public } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Route name is required" }, { status: 400 });
    }

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return NextResponse.json({ error: "At least 2 waypoints are required" }, { status: 400 });
    }

    // Validate each waypoint
    for (let i = 0; i < waypoints.length; i++) {
      if (!validateWaypoint(waypoints[i])) {
        return NextResponse.json(
          { error: `Waypoint ${i + 1} has invalid coordinates. Must be within the Great Lakes region.` },
          { status: 400 }
        );
      }
    }

    // Check user route limit
    const { count } = await supabase
      .from("passage_routes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_system", false);

    if ((count || 0) >= MAX_USER_ROUTES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_USER_ROUTES} routes per account. Delete unused routes to create new ones.` },
        { status: 400 }
      );
    }

    // Build waypoint objects with names
    const cleanWaypoints = waypoints.map((wp: any, i: number) => ({
      lat: Math.round(wp.lat * 10000) / 10000,
      lng: Math.round(wp.lng * 10000) / 10000,
      name: wp.name?.trim() || `Waypoint ${i + 1}`,
      notes: wp.notes?.trim() || null,
    }));

    // Compute rhumb line distance
    const rhumbDistance = computeRhumbDistance(cleanWaypoints);

    // Departure = first waypoint, arrival = last waypoint
    const departure = cleanWaypoints[0];
    const arrival = cleanWaypoints[cleanWaypoints.length - 1];

    const { data, error } = await supabase
      .from("passage_routes")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        departure_name: departure.name,
        departure_lat: departure.lat,
        departure_lng: departure.lng,
        arrival_name: arrival.name,
        arrival_lat: arrival.lat,
        arrival_lng: arrival.lng,
        waypoints: cleanWaypoints,
        rhumb_line_distance_nm: rhumbDistance,
        course_type: course_type || "passage",
        region: region || null,
        difficulty: difficulty || null,
        is_public: is_public === true ? true : false,
        is_system: false,
        tags: [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ route: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create route" },
      { status: 500 }
    );
  }
}
