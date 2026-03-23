"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import type { Boat } from "@/lib/types/database";
import {
  Trophy,
  TrendingUp,
  Users,
  BarChart3,
  Medal,
  Target,
  Anchor,
  Loader2,
  Download,
  ChevronDown,
  ChevronUp,
  Sailboat,
  Zap,
} from "lucide-react";
import { exportPerformancePDF } from "@/lib/utils/pdf-export";

// ─── Types ──────────────────────────────────────────────────────────

interface RaceDetail {
  id: string;
  race_id: string;
  boat_id: string;
  fleet: string;
  finish_position: number | null;
  corrected_position: number | null;
  elapsed_time_sec: number | null;
  corrected_time_sec: number | null;
  status: string;
  vmg_kts: number | null;
  race?: {
    id: string;
    race_number: number;
    scheduled_start: string;
    course_type: string | null;
    regatta_id: string;
  };
  regatta?: {
    id: string;
    name: string;
  };
}

interface CompetitorStats {
  boat_id: string;
  boat_name: string;
  sail_number: string | null;
  class_name: string;
  phrf_rating: number | null;
  shared_races: number;
  wins: number;
  losses: number;
  same_fleet: boolean;
}

interface SeriesStanding {
  regatta_id: string;
  regatta_name: string;
  fleet: string;
  total_points: number;
  races_completed: number;
  place: number | null;
  fleet_size: number;
}

interface ExpandedRaceResult {
  boat_id: string;
  boat_name: string;
  sail_number: string | null;
  class_name: string;
  phrf_rating: number | null;
  corrected_position: number | null;
  finish_position: number | null;
  elapsed_time_sec: number | null;
  corrected_time_sec: number | null;
  status: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "finished":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "dnc":
    case "dns":
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    case "dnf":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "dsq":
    case "ocs":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function ratingDelta(myRating: number | null, theirRating: number | null): string {
  if (!myRating || !theirRating) return "";
  const diff = myRating - theirRating;
  if (diff > 0) return `+${diff}s/mi slower`;
  if (diff < 0) return `${Math.abs(diff)}s/mi faster`;
  return "same rating";
}

function winRate(wins: number, losses: number): number {
  const total = wins + losses;
  return total > 0 ? Math.round((wins / total) * 100) : 0;
}

// ─── Main Component ─────────────────────────────────────────────────

export default function PerformancePage() {
  const [boat, setBoat] = useState<Boat | null>(null);
  const [results, setResults] = useState<RaceDetail[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorStats[]>([]);
  const [seriesStandings, setSeriesStandings] = useState<SeriesStanding[]>([]);
  const [expandedRace, setExpandedRace] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState<ExpandedRaceResult[]>([]);
  const [loadingExpanded, setLoadingExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all data
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();

        // Get the user's primary boat
        const { data: { user } } = await supabase.auth.getUser();
        let boatQuery = supabase.from("boats").select("*");

        if (user) {
          boatQuery = boatQuery.eq("owner_id", user.id).eq("is_primary", true);
        } else {
          // Fallback to Impetuous for demo/unauthenticated
          boatQuery = boatQuery.eq("id", "d3099269-e402-4c95-b47a-74cd1bb4164c");
        }

        const { data: boatData, error: boatError } = await boatQuery.single();

        if (boatError || !boatData) {
          setError("No boat found. Add a boat in Menu > My Boats to see performance data.");
          setIsLoading(false);
          return;
        }

        const myBoat = boatData as Boat;
        setBoat(myBoat);

        // Get all race results with race + regatta context
        const { data: resultsData } = await supabase
          .from("race_results")
          .select(`
            *,
            race:races(id, race_number, scheduled_start, course_type, regatta_id)
          `)
          .eq("boat_id", myBoat.id);

        if (!resultsData || resultsData.length === 0) {
          setResults([]);
          setIsLoading(false);
          return;
        }

        // Get all regatta names
        const { data: regattaData } = await supabase.from("regattas").select("id, name");
        const regattaMap: Record<string, string> = {};
        if (regattaData) {
          for (const r of regattaData) {
            regattaMap[(r as any).id] = (r as any).name;
          }
        }

        // Enrich and sort results
        const enriched: RaceDetail[] = resultsData
          .map((r: any) => {
            const race = r.race as any;
            const regattaId = race?.regatta_id;
            return {
              ...r,
              race,
              regatta: regattaId ? { id: regattaId, name: regattaMap[regattaId] || "Unknown" } : undefined,
            };
          })
          .sort((a: any, b: any) => {
            const dateA = a.race?.scheduled_start || "";
            const dateB = b.race?.scheduled_start || "";
            return dateB.localeCompare(dateA);
          });

        setResults(enriched);

        // ── Compute series standings ──
        const standingsCalc: Record<string, { points: number; races: number; fleet: string }> = {};
        for (const r of enriched) {
          if (!r.regatta?.id) continue;
          const key = `${r.regatta.id}::${r.fleet}`;
          if (!standingsCalc[key]) {
            standingsCalc[key] = { points: 0, races: 0, fleet: r.fleet };
          }
          if (r.corrected_position) {
            standingsCalc[key].points += r.corrected_position;
          }
          standingsCalc[key].races += 1;
        }

        // Get fleet standings to compute place
        const raceIds = enriched.map((r: any) => r.race_id).filter(Boolean);
        const { data: allFleetResults } = await supabase
          .from("race_results")
          .select("boat_id, race_id, fleet, corrected_position")
          .in("race_id", raceIds);

        // Group all results by regatta+fleet to compute places
        const raceToRegatta: Record<string, string> = {};
        for (const r of enriched) {
          if (r.race?.id && r.regatta?.id) raceToRegatta[r.race.id] = r.regatta.id;
        }

        const fleetTotals: Record<string, Record<string, number>> = {}; // key -> boat_id -> total points
        if (allFleetResults) {
          for (const r of allFleetResults as any[]) {
            const regattaId = raceToRegatta[r.race_id];
            if (!regattaId || !r.corrected_position) continue;
            const key = `${regattaId}::${r.fleet}`;
            if (!fleetTotals[key]) fleetTotals[key] = {};
            if (!fleetTotals[key][r.boat_id]) fleetTotals[key][r.boat_id] = 0;
            fleetTotals[key][r.boat_id] += r.corrected_position;
          }
        }

        const standings: SeriesStanding[] = Object.entries(standingsCalc).map(([key, data]) => {
          const [regattaId] = key.split("::");
          const totals = fleetTotals[key] || {};
          const sorted = Object.entries(totals).sort(([, a], [, b]) => a - b);
          const myPlace = sorted.findIndex(([id]) => id === myBoat.id) + 1;
          return {
            regatta_id: regattaId,
            regatta_name: regattaMap[regattaId] || "Unknown",
            fleet: data.fleet,
            total_points: data.points,
            races_completed: data.races,
            place: myPlace > 0 ? myPlace : null,
            fleet_size: sorted.length,
          };
        });

        setSeriesStandings(standings.sort((a, b) => (a.place || 999) - (b.place || 999)));

        // ── Compute competitor stats ──
        const competitorMap: Record<string, CompetitorStats> = {};
        const ourPositionByRace: Record<string, number> = {};
        const ourFleetByRace: Record<string, string> = {};

        for (const r of enriched) {
          if (r.race_id && r.corrected_position) ourPositionByRace[r.race_id] = r.corrected_position;
          if (r.race_id && r.fleet) ourFleetByRace[r.race_id] = r.fleet;
        }

        if (raceIds.length > 0) {
          const { data: compResults } = await supabase
            .from("race_results")
            .select("race_id, boat_id, corrected_position, fleet, boat:boats(id, name, sail_number, class_name, phrf_rating)")
            .in("race_id", raceIds)
            .neq("boat_id", myBoat.id);

          if (compResults) {
            for (const comp of compResults as any[]) {
              const cId = comp.boat_id;
              const ourFleet = ourFleetByRace[comp.race_id];

              // Track all competitors but flag if same fleet
              const sameFleet = ourFleet === comp.fleet;

              if (!competitorMap[cId]) {
                competitorMap[cId] = {
                  boat_id: cId,
                  boat_name: comp.boat?.name || "Unknown",
                  sail_number: comp.boat?.sail_number || null,
                  class_name: comp.boat?.class_name || "",
                  phrf_rating: comp.boat?.phrf_rating || null,
                  shared_races: 0,
                  wins: 0,
                  losses: 0,
                  same_fleet: sameFleet,
                };
              }

              // Only count same-fleet races for head-to-head
              if (!sameFleet) continue;

              competitorMap[cId].shared_races += 1;
              const ourPos = ourPositionByRace[comp.race_id];
              const theirPos = comp.corrected_position;
              if (ourPos && theirPos) {
                if (ourPos < theirPos) competitorMap[cId].wins += 1;
                else if (ourPos > theirPos) competitorMap[cId].losses += 1;
              }
            }
          }
        }

        // Only show competitors we've actually raced against in same fleet
        setCompetitors(
          Object.values(competitorMap)
            .filter((c) => c.shared_races > 0)
            .sort((a, b) => b.shared_races - a.shared_races)
        );

        setIsLoading(false);
      } catch (err) {
        console.error("Error loading performance data:", err);
        setError("Failed to load performance data");
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Load full race results when expanding a race row
  const loadRaceResults = useCallback(async (raceId: string, fleet: string) => {
    if (expandedRace === raceId) {
      setExpandedRace(null);
      return;
    }

    setExpandedRace(raceId);
    setLoadingExpanded(true);

    const supabase = createClient();
    const { data } = await supabase
      .from("race_results")
      .select("*, boat:boats(id, name, sail_number, class_name, phrf_rating)")
      .eq("race_id", raceId)
      .eq("fleet", fleet)
      .order("corrected_position", { ascending: true });

    if (data) {
      setExpandedResults(
        data.map((r: any) => ({
          boat_id: r.boat_id,
          boat_name: r.boat?.name || "Unknown",
          sail_number: r.boat?.sail_number || null,
          class_name: r.boat?.class_name || "",
          phrf_rating: r.boat?.phrf_rating || null,
          corrected_position: r.corrected_position,
          finish_position: r.finish_position,
          elapsed_time_sec: r.elapsed_time_sec,
          corrected_time_sec: r.corrected_time_sec,
          status: r.status,
        }))
      );
    }
    setLoadingExpanded(false);
  }, [expandedRace]);

  // PDF export handler
  function handleExportPDF() {
    if (!boat) return;

    const raceLog = results.map((r) => ({
      date: r.race?.scheduled_start
        ? new Date(r.race.scheduled_start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "—",
      regatta: r.regatta?.name || "—",
      fleet: r.fleet || "—",
      position: r.status === "finished" ? String(r.corrected_position || "—") : "—",
      status: r.status,
      elapsed: r.elapsed_time_sec ? formatElapsed(r.elapsed_time_sec) : "—",
    }));

    const compData = competitors.map((c) => ({
      boat_name: c.boat_name,
      sail_number: c.sail_number || "",
      shared_events: c.shared_races,
      wins: c.wins,
      losses: c.losses,
    }));

    exportPerformancePDF(
      boat.name,
      boat.sail_number || "",
      {
        totalRaces: results.length,
        wins: results.filter((r) => r.corrected_position === 1).length,
        podiums: results.filter((r) => r.corrected_position && r.corrected_position <= 3).length,
        avgPosition: avgPosition,
      },
      raceLog,
      compData
    );
  }

  // ── Loading/Error states ──
  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <Header title="Performance" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !boat) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <Header title="Performance" />
        <div className="space-y-4 p-4 text-center">
          <Sailboat className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error || "No boat found"}</p>
        </div>
      </div>
    );
  }

  // ── Computed stats ──
  const totalRaces = results.length;
  const wins = results.filter((r) => r.corrected_position === 1).length;
  const podiums = results.filter((r) => r.corrected_position && r.corrected_position <= 3).length;
  const finishedResults = results.filter((r) => r.status === "finished" && r.corrected_position);
  const avgPosition =
    finishedResults.length > 0
      ? (finishedResults.reduce((sum, r) => sum + (r.corrected_position || 0), 0) / finishedResults.length).toFixed(1)
      : "N/A";
  const vmgResults = results.filter((r) => r.vmg_kts);
  const avgVMG = vmgResults.length > 0
    ? (vmgResults.reduce((sum, r) => sum + (r.vmg_kts || 0), 0) / vmgResults.length).toFixed(2)
    : null;

  // Performance trend data (chronological, oldest first for the chart)
  const trendData = [...results].reverse().slice(-20);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Performance" />

      <div className="space-y-6 p-4 pb-8">
        {/* ── Section 1: Boat Summary ── */}
        <section className="rounded-xl border bg-card shadow-sm">
          <div className="p-4">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{boat.name}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {boat.sail_number && <span className="font-medium">{boat.sail_number}</span>}
                  {boat.sail_number && " · "}
                  {boat.class_name}
                  {boat.phrf_rating && ` · PHRF ${boat.phrf_rating}`}
                </p>
              </div>
              <button
                onClick={handleExportPDF}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Export as PDF"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-5">
              <StatCard icon={<Trophy className="h-4 w-4 text-ocean" />} value={totalRaces} label="Races" />
              <StatCard icon={<Medal className="h-4 w-4 text-yellow-500" />} value={wins} label="Wins" />
              <StatCard icon={<Target className="h-4 w-4 text-green-500" />} value={podiums} label="Podiums" />
              <StatCard icon={<BarChart3 className="h-4 w-4 text-blue-500" />} value={avgPosition} label="Avg Pos" />
              {avgVMG && (
                <StatCard icon={<Zap className="h-4 w-4 text-purple-500" />} value={avgVMG} label="Avg VMG" />
              )}
            </div>
          </div>
        </section>

        {/* ── Section 2: Performance Trend ── */}
        {trendData.length > 2 && (
          <section>
            <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Season Trend" />
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-end gap-1" style={{ height: "100px" }}>
                {trendData.map((result, idx) => {
                  const pos = result.corrected_position;
                  const isFinished = result.status === "finished" && pos;
                  const maxHeight = 90;
                  const barHeight = !isFinished ? 6 : Math.max(8, maxHeight - ((pos || 1) - 1) * 8);
                  const color = !isFinished
                    ? "bg-gray-300 dark:bg-gray-600"
                    : pos && pos <= 1
                      ? "bg-yellow-400 dark:bg-yellow-500"
                      : pos && pos <= 3
                        ? "bg-green-400 dark:bg-green-600"
                        : pos && pos <= 6
                          ? "bg-blue-400 dark:bg-blue-500"
                          : "bg-gray-400 dark:bg-gray-500";

                  return (
                    <div
                      key={idx}
                      className="flex flex-1 flex-col items-center"
                      title={`${result.regatta?.name || ""} R${result.race?.race_number || ""}: ${isFinished ? `P${pos}` : result.status.toUpperCase()}`}
                    >
                      <span className="mb-1 text-[8px] text-muted-foreground">
                        {isFinished ? pos : ""}
                      </span>
                      <div
                        className={`w-full rounded-t ${color} transition-all`}
                        style={{ height: `${barHeight}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-muted-foreground">
                <span>Oldest</span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-yellow-400" />1st</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-green-400" />Top 3</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-blue-400" />4-6</span>
                </span>
                <span>Recent</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Section 3: Series Standings ── */}
        {seriesStandings.length > 0 && (
          <section>
            <SectionHeader icon={<BarChart3 className="h-4 w-4" />} title="Series Results" />
            <div className="space-y-2">
              {seriesStandings.map((s) => (
                <div key={`${s.regatta_id}-${s.fleet}`} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-foreground">{s.regatta_name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {s.fleet} · {s.races_completed} race{s.races_completed !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      {s.place && (
                        <p className="text-lg font-bold text-foreground">
                          {s.place}<span className="text-xs font-normal text-muted-foreground">/{s.fleet_size}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">{s.total_points} pts</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Section 4: Race Log (expandable) ── */}
        {results.length > 0 && (
          <section>
            <SectionHeader icon={<Anchor className="h-4 w-4" />} title="Race Log" subtitle="Tap a race to see full results" />
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="divide-y">
                {results.map((result) => {
                  const isExpanded = expandedRace === result.race_id;
                  return (
                    <div key={result.id}>
                      <button
                        onClick={() => loadRaceResults(result.race_id, result.fleet)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
                      >
                        <div className="w-12 shrink-0 text-xs font-medium text-foreground">
                          {result.race?.scheduled_start ? formatDate(result.race.scheduled_start) : "—"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-muted-foreground">
                            {result.regatta?.name || "—"}
                            <span className="text-muted-foreground/60"> · R{result.race?.race_number}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{result.fleet}</span>
                          {result.status === "finished" ? (
                            <span className={`w-7 text-center text-sm font-bold ${
                              result.corrected_position === 1
                                ? "text-yellow-600 dark:text-yellow-400"
                                : result.corrected_position && result.corrected_position <= 3
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-foreground"
                            }`}>
                              {result.corrected_position}
                            </span>
                          ) : (
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${getStatusColor(result.status)}`}>
                              {result.status.toUpperCase()}
                            </span>
                          )}
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          }
                        </div>
                      </button>

                      {/* Expanded: full race results */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20 px-3 py-2">
                          {loadingExpanded ? (
                            <div className="flex justify-center py-3">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="py-1 text-left font-medium">Pos</th>
                                  <th className="py-1 text-left font-medium">Boat</th>
                                  <th className="py-1 text-left font-medium">Class</th>
                                  <th className="py-1 text-right font-medium">PHRF</th>
                                  {expandedResults.some((r) => r.elapsed_time_sec) && (
                                    <th className="py-1 text-right font-medium">Time</th>
                                  )}
                                  <th className="py-1 text-right font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {expandedResults.map((r) => {
                                  const isMe = r.boat_id === boat.id;
                                  return (
                                    <tr key={r.boat_id} className={isMe ? "bg-blue-50/80 dark:bg-blue-950/30 font-medium" : ""}>
                                      <td className="py-1.5 pr-1 font-semibold">{r.corrected_position || "—"}</td>
                                      <td className="py-1.5">
                                        <span className={isMe ? "text-ocean font-semibold" : ""}>{r.boat_name}</span>
                                        {r.sail_number && (
                                          <span className="ml-1 text-muted-foreground/60">{r.sail_number}</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-muted-foreground">{r.class_name}</td>
                                      <td className="py-1.5 text-right text-muted-foreground">{r.phrf_rating || "—"}</td>
                                      {expandedResults.some((er) => er.elapsed_time_sec) && (
                                        <td className="py-1.5 text-right text-muted-foreground">
                                          {r.corrected_time_sec ? formatElapsed(r.corrected_time_sec) : r.elapsed_time_sec ? formatElapsed(r.elapsed_time_sec) : "—"}
                                        </td>
                                      )}
                                      <td className="py-1.5 text-right">
                                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${getStatusColor(r.status)}`}>
                                          {r.status.toUpperCase()}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Section 5: Competitor Analysis ── */}
        {competitors.length > 0 && (
          <section>
            <SectionHeader
              icon={<Users className="h-4 w-4" />}
              title="Head-to-Head"
              subtitle="Same-fleet competitors by shared races"
            />
            <div className="space-y-2">
              {competitors.slice(0, 15).map((comp) => {
                const wr = winRate(comp.wins, comp.losses);
                return (
                  <div key={comp.boat_id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-foreground">{comp.boat_name}</h4>
                          {comp.sail_number && (
                            <span className="text-[10px] text-muted-foreground">{comp.sail_number}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {comp.class_name}
                          {comp.phrf_rating && ` · PHRF ${comp.phrf_rating}`}
                          {boat.phrf_rating && comp.phrf_rating && (
                            <span className="text-muted-foreground/60"> · {ratingDelta(boat.phrf_rating, comp.phrf_rating)}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center">
                          <p className="text-xs font-semibold text-muted-foreground">{comp.shared_races}</p>
                          <p className="text-[9px] text-muted-foreground">races</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-semibold text-green-600 dark:text-green-400">{comp.wins}</p>
                          <p className="text-[9px] text-muted-foreground">W</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-semibold text-red-600 dark:text-red-400">{comp.losses}</p>
                          <p className="text-[9px] text-muted-foreground">L</p>
                        </div>
                      </div>
                    </div>
                    {/* Win rate bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-red-200 dark:bg-red-900/30">
                        <div
                          className="h-full rounded-full bg-green-500 dark:bg-green-400 transition-all"
                          style={{ width: `${wr}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold ${wr >= 50 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {wr}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-2xl font-bold text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h3>
      {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
