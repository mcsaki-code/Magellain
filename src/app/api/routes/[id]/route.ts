import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server component
          }
        },
      },
    }
  );
}

// ─── PUT /api/routes/[id] ─────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in to edit routes" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, waypoints, course_type, region, difficulty, is_public } = body;

    // Validate
    if (name !== undefined && (!name || typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "Route name cannot be empty" }, { status: 400 });
    }

    if (waypoints !== undefined) {
      if (!Array.isArray(waypoints) || waypoints.length < 2) {
        return NextResponse.json({ error: "At least 2 waypoints are required" }, { status: 400 });
      }
      for (let i = 0; i < waypoints.length; i++) {
        if (!validateWaypoint(waypoints[i])) {
          return NextResponse.json(
            { error: `Waypoint ${i + 1} has invalid coordinates.` },
            { status: 400 }
          );
        }
      }
    }

    // Build update object
    const update: any = { updated_at: new Date().toISOString() };

    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description?.trim() || null;
    if (course_type !== undefined) update.course_type = course_type;
    if (region !== undefined) update.region = region;
    if (difficulty !== undefined) update.difficulty = difficulty;
    if (is_public !== undefined) update.is_public = is_public === true;

    if (waypoints !== undefined) {
      const cleanWaypoints = waypoints.map((wp: any, i: number) => ({
        lat: Math.round(wp.lat * 10000) / 10000,
        lng: Math.round(wp.lng * 10000) / 10000,
        name: wp.name?.trim() || `Waypoint ${i + 1}`,
        notes: wp.notes?.trim() || null,
      }));

      update.waypoints = cleanWaypoints;
      update.rhumb_line_distance_nm = computeRhumbDistance(cleanWaypoints);
      update.departure_name = cleanWaypoints[0].name;
      update.departure_lat = cleanWaypoints[0].lat;
      update.departure_lng = cleanWaypoints[0].lng;
      update.arrival_name = cleanWaypoints[cleanWaypoints.length - 1].name;
      update.arrival_lat = cleanWaypoints[cleanWaypoints.length - 1].lat;
      update.arrival_lng = cleanWaypoints[cleanWaypoints.length - 1].lng;
    }

    // RLS ensures user can only update their own non-system routes
    const { data, error } = await supabase
      .from("passage_routes")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Route not found or you don't have permission to edit it" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ route: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update route" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/routes/[id] ──────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in to delete routes" }, { status: 401 });
    }

    // RLS ensures user can only delete their own non-system routes
    const { error } = await supabase
      .from("passage_routes")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete route" },
      { status: 500 }
    );
  }
}
