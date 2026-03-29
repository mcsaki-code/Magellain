import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Admin emails allowed to see telemetry
const ADMIN_EMAILS = ["mattcsaki@gmail.com"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Total page views
    const { count: totalPageViews } = await supabase
      .from("page_views")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    // 2. Unique sessions
    const { data: sessionData } = await supabase
      .from("page_views")
      .select("session_id")
      .gte("created_at", since);
    const uniqueSessions = new Set(sessionData?.map((r: { session_id: string }) => r.session_id)).size;

    // 3. Unique users (authenticated)
    const { data: userData } = await supabase
      .from("page_views")
      .select("user_id")
      .gte("created_at", since)
      .not("user_id", "is", null);
    const uniqueUsers = new Set(userData?.map((r: { user_id: string }) => r.user_id)).size;

    // 4. Page views by path (top pages)
    const { data: pageViewsByPath } = await supabase
      .from("page_views")
      .select("page_path, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    const pathCounts: Record<string, number> = {};
    pageViewsByPath?.forEach((pv: { page_path: string }) => {
      pathCounts[pv.page_path] = (pathCounts[pv.page_path] || 0) + 1;
    });
    const topPages = Object.entries(pathCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([path, views]) => ({ path, views }));

    // 5. Daily page view trend
    const dailyTrend: Record<string, number> = {};
    pageViewsByPath?.forEach((pv: { created_at: string }) => {
      const day = pv.created_at.slice(0, 10);
      dailyTrend[day] = (dailyTrend[day] || 0) + 1;
    });
    const trend = Object.entries(dailyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, views]) => ({ date, views }));

    // 6. Feature events summary
    const { data: featureEvents } = await supabase
      .from("feature_events")
      .select("event_name, created_at")
      .gte("created_at", since);

    const eventCounts: Record<string, number> = {};
    featureEvents?.forEach((e: { event_name: string }) => {
      eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1;
    });
    const topEvents = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([event, count]) => ({ event, count }));

    // 7. Feedback summary
    const { data: feedbackData } = await supabase
      .from("user_feedback")
      .select("id, category, subject, status, created_at, email")
      .order("created_at", { ascending: false })
      .limit(50);

    const feedbackByCategory: Record<string, number> = {};
    const feedbackByStatus: Record<string, number> = {};
    feedbackData?.forEach((f: { category: string; status: string }) => {
      feedbackByCategory[f.category] = (feedbackByCategory[f.category] || 0) + 1;
      feedbackByStatus[f.status] = (feedbackByStatus[f.status] || 0) + 1;
    });

    // 8. Profiles count
    const { count: totalProfiles } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // 9. Boats count
    const { count: totalBoats } = await supabase
      .from("boats")
      .select("*", { count: "exact", head: true });

    // 10. Routes count
    const { count: totalRoutes } = await supabase
      .from("passage_routes")
      .select("*", { count: "exact", head: true });

    // 11. Route computations
    const { count: totalComputations } = await supabase
      .from("route_computations")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      period: { days, since },
      kpis: {
        totalPageViews: totalPageViews || 0,
        uniqueSessions,
        uniqueUsers,
        totalProfiles: totalProfiles || 0,
        totalBoats: totalBoats || 0,
        totalRoutes: totalRoutes || 0,
        totalComputations: totalComputations || 0,
      },
      topPages,
      trend,
      topEvents,
      feedback: {
        items: feedbackData || [],
        byCategory: feedbackByCategory,
        byStatus: feedbackByStatus,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Telemetry fetch failed" },
      { status: 500 }
    );
  }
}
