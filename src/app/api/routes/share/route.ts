import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/routes/share?id=... — get a public route by ID for sharing
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing route id" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: route, error } = await supabase
      .from("passage_routes")
      .select("id, name, category, is_public, waypoints, total_distance_nm, created_at, user_id")
      .eq("id", id)
      .eq("is_public", true)
      .single();

    if (error || !route) {
      return NextResponse.json({ error: "Route not found or not public" }, { status: 404 });
    }

    // Get creator display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", route.user_id)
      .single();

    return NextResponse.json({
      route: {
        ...route,
        creator_name: profile?.display_name || "Anonymous",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch route" },
      { status: 500 }
    );
  }
}
