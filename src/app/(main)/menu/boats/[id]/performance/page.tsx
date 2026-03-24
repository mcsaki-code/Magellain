"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import type { Boat, RaceResult } from "@/lib/types/database";
import {
  Trophy,
  TrendingUp,
  Users,
  BarChart3,
  ChevronLeft,
  Medal,
  Target,
  Anchor,
  Loader2,
  Download,
} from "lucide-react";
import Link from "next/link";
import { exportPerformancePDF } from "@/lib/utils/pdf-export";

interface RaceWithDetails extends RaceResult {
  race?: {
    id: string;
    race_number: number;
    scheduled_start: string;
    course_type: string | null;
  };
  regatta?: {
    id: string;
    name: string;
  };
  boat?: {
    id: string;
    name: string;
    sail_number: string | null;
  };
}

interface CompetitorStats {
  boat_id: string;
  boat_name: string;
  sail_number: string | null;
  shared_events: number;
  wins: number;
  losses: number;
}

interface SeriesStanding {
  regatta_id: string;
  regatta_name: string;
  total_points: number;
  races_completed: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function getPerformanceColor(position: number | null, status: string): string {
  if (status !== "finished" || position === null) return "bg-gray-300 dark:bg-gray-600";
  if (position <= 3) return "bg-green-400 dark:bg-green-600";
  if (position <= 6) return "bg-yellow-400 dark:bg-yellow-600";
  return "bg-red-400 dark:bg-red-600";
}

export default function BoatPerformancePage({ params }: { params: { id: string } }) {
  const [boat, setBoat] = useState<Boat | null>(null);
  const [results, setResults] = useState<RaceWithDetails[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorStats[]>([]);
  const [seriesStandings, setSeriesStandings] = useState<SeriesStanding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();

        // Get boat details
        const { data: boatData, error: boatError } = await supabase
          .from("boats")
          .select("*")
          .eq("id", params.id)
          .single();

        if (boatError || !boatData) {
          setError("Boat not found");
          setIsLoading(false);
          return;
        }

        setBoat(boatData as Boat);

        // Get all race results for this boat with race details
        const { data: resultsData, error: resultsError } = await supabase
          .from("race_results")
          .select(
            `
            *,
            race:races(id, race_number, scheduled_start, course_type, regatta_id),
            boat:boats(id, name, sail_number)
          `
          )
          .eq("boat_id", params.id);

        if (resultsError) {
          console.error("Results error:", resultsError);
          setError("Failed to load race results");
          setIsLoading(false);
          return;
        }

        if (resultsData) {
          // Get regatta names for all regattas
          const { data: regattaData } = await supabase
            .from("regattas")
            .select("id, name");

          const regattaMap: Record<string, string> = {};
          if (regattaData) {
            regattaData.forEach((r: any) => {
              regattaMap[r.id] = r.name;
            });
          }

          // Enrich results with regatta info from the race's regatta_id
          const enrichedResults = resultsData
            .map((r: any) => {
              const race = r.race as any;
              const regattaId = race?.regatta_id;
              const regattaName = regattaId ? regattaMap[regattaId] : undefined;

              return {
                ...r,
                race,
                regatta: regattaName ? { id: regattaId, name: regattaName } : undefined,
              };
            })
            // Sort by date descending (since we can't use nested order in Supabase)
            .sort((a: any, b: any) => {
              const dateA = a.race?.scheduled_start || "";
              const dateB = b.race?.scheduled_start || "";
              return dateB.localeCompare(dateA);
            });

          setResults(enrichedResults as RaceWithDetails[]);

          // Calculate series standings
          const standingsMap: Record<string, { points: number; races: number }> = {};
          enrichedResults.forEach((r: any) => {
            if (r.regatta?.id) {
              if (!standingsMap[r.regatta.id]) {
                standingsMap[r.regatta.id] = { points: 0, races: 0 };
              }
              if (r.corrected_position) {
                standingsMap[r.regatta.id].points += r.corrected_position;
              }
              standingsMap[r.regatta.id].races += 1;
            }
          });

          const standings: SeriesStanding[] = Object.entries(standingsMap).map(
            ([regattaId, data]) => ({
              regatta_id: regattaId,
              regatta_name: regattaMap[regattaId] || "Unknown",
              total_points: data.points,
              races_completed: data.races,
            })
          );

          setSeriesStandings(standings);

          // Calculate competitor stats using a single batch query
          const competitorMap: Record<string, CompetitorStats> = {};

          const raceIds = enrichedResults
            .map((r: any) => r.race_id)
            .filter((id: any) => id);

          if (raceIds.length > 0) {
            // Single query: get ALL results for races this boat participated in
            const { data: allResults } = await supabase
              .from("race_results")
              .select("race_id, boat_id, corrected_position, status, fleet, boat:boats(id, name, sail_number)")
              .in("race_id", raceIds)
              .neq("boat_id", params.id);

            if (allResults) {
              // Build our position lookup: race_id -> our corrected_position
              const ourPositionByRace: Record<string, number> = {};
              const ourFleetByRace: Record<string, string> = {};
              enrichedResults.forEach((r: any) => {
                if (r.race_id && r.corrected_position) {
                  ourPositionByRace[r.race_id] = r.corrected_position;
                }
                if (r.race_id && r.fleet) {
                  ourFleetByRace[r.race_id] = r.fleet;
                }
              });

              // Process all competitor results in one pass
              allResults.forEach((comp: any) => {
                const competitorId = comp.boat_id;

                // Only compare within the same fleet
                const ourFleet = ourFleetByRace[comp.race_id];
                if (ourFleet && comp.fleet !== ourFleet) return;

                if (!competitorMap[competitorId]) {
                  competitorMap[competitorId] = {
                    boat_id: competitorId,
                    boat_name: (comp.boat as any)?.name || "Unknown",
                    sail_number: (comp.boat as any)?.sail_number || null,
                    shared_events: 0,
                    wins: 0,
                    losses: 0,
                  };
                }

                competitorMap[competitorId].shared_events += 1;

                // Head-to-head: compare positions in same race
                const ourPosition = ourPositionByRace[comp.race_id];
                const compPosition = comp.corrected_position;

                if (ourPosition && compPosition) {
                  if (ourPosition < compPosition) {
                    competitorMap[competitorId].wins += 1;
                  } else if (ourPosition > compPosition) {
                    competitorMap[competitorId].losses += 1;
                  }
                }
              });

              setCompetitors(
                Object.values(competitorMap).sort((a, b) => b.shared_events - a.shared_events)
              );
            }
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error loading boat data:", err);
        setError("Failed to load boat performance data");
        setIsLoading(false);
      }
    }

    loadData();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <Header title="Performance">
          <Link href="/menu/boats" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Header>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !boat) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <Header title="Performance">
          <Link href="/menu/boats" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Header>
        <div className="space-y-4 p-4 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error || "Boat not found"}</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalRaces = results.length;
  const wins = results.filter((r) => r.corrected_position === 1).length;
  const podiums = results.filter((r) => r.corrected_position && r.corrected_position <= 3).length;
  const finishedResults = results.filter((r) => r.status === "finished" && r.corrected_position);
  const avgPosition =
    finishedResults.length > 0
      ? (
          finishedResults.reduce((sum, r) => sum + (r.corrected_position || 0), 0) /
          finishedResults.length
        ).toFixed(2)
      : "N/A";

  function handleExportPDF() {
    if (!boat) return;

    const raceLog = results.map((r) => ({
      date: r.race?.scheduled_start
        ? new Date(r.race.scheduled_start).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
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
      shared_events: c.shared_events,
      wins: c.wins,
      losses: c.losses,
    }));

    exportPerformancePDF(
      boat.name,
      boat.sail_number || "",
      { totalRaces, wins, podiums, avgPosition: String(avgPosition) },
      raceLog,
      compData
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Performance">
        <Link href="/menu/boats" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
      </Header>

      <div className="space-y-6 p-4 pb-8">
        {/* Section 1: Boat Summary Card */}
        <section className="rounded-xl border bg-card shadow-sm">
          <div className="p-4">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{boat.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {boat.sail_number && <span className="font-medium">{boat.sail_number}</span>}
                  {boat.sail_number && " • "}
                  <span>{boat.class_name}</span>
                  {boat.manufacturer && ` • ${boat.manufacturer}`}
                  {boat.year_built && ` ${boat.year_built}`}
                </p>
              </div>
              <button
                onClick={handleExportPDF}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Export performance report as PDF"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
            </div>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Trophy className="h-4 w-4 text-ocean" />
                  <span className="text-2xl font-bold text-foreground">{totalRaces}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Total Races</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Medal className="h-4 w-4 text-yellow-500" />
                  <span className="text-2xl font-bold text-foreground">{wins}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Wins</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Target className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold text-foreground">{podiums}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Podiums</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold text-foreground">{avgPosition}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Avg Pos</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Performance Trend */}
        {results.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Performance Trend
            </h3>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-end gap-1">
                {results.slice(0, 20).map((result, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`Race ${idx + 1}: ${result.corrected_position || "DNF"}`}
                  >
                    <div
                      className={`w-full rounded-t transition-all ${getPerformanceColor(result.corrected_position, result.status)}`}
                      style={{
                        height: `${
                          result.status !== "finished"
                            ? 8
                            : Math.max(8, 100 - (result.corrected_position || 0) * 5)
                        }px`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
                <span>Green: Top 3</span>
                <span>Yellow: 4-6</span>
                <span>Red: 7+/DNF/DNC</span>
              </div>
            </div>
          </section>
        )}

        {/* Section 3: Race Log */}
        {results.length > 0 ? (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Anchor className="h-4 w-4 text-muted-foreground" />
              Race Log
            </h3>
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-foreground">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-foreground">Regatta</th>
                      <th className="px-3 py-2 text-center font-semibold text-foreground">Fleet</th>
                      <th className="px-3 py-2 text-center font-semibold text-foreground">Pos</th>
                      <th className="px-3 py-2 text-center font-semibold text-foreground">Status</th>
                      {results.some((r) => r.elapsed_time_sec) && (
                        <th className="px-3 py-2 text-right font-semibold text-foreground">Time</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((result, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-muted/30 transition-colors border-border/50"
                      >
                        <td className="px-3 py-2.5 text-xs font-medium text-foreground whitespace-nowrap">
                          {result.race?.scheduled_start
                            ? formatDate(result.race.scheduled_start)
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-xs">
                          {result.regatta?.name || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-center text-muted-foreground">
                          {result.fleet || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-foreground">
                          {result.status === "finished" ? result.corrected_position || "—" : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusColor(result.status)}`}
                          >
                            {result.status.toUpperCase()}
                          </span>
                        </td>
                        {results.some((r) => r.elapsed_time_sec) && (
                          <td className="px-3 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                            {result.elapsed_time_sec ? formatElapsed(result.elapsed_time_sec) : "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border bg-card p-6 text-center">
            <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No race results yet</p>
          </section>
        )}

        {/* Section 4: Series Standings */}
        {seriesStandings.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Series Standings
            </h3>
            <div className="space-y-2">
              {seriesStandings
                .sort((a, b) => a.total_points - b.total_points)
                .map((standing) => (
                  <div key={standing.regatta_id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-foreground">{standing.regatta_name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {standing.races_completed} race{standing.races_completed !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          {standing.total_points}
                        </p>
                        <p className="text-[10px] text-muted-foreground">points</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Section 5: Competitor Frequency */}
        {competitors.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" />
              Frequent Competitors
            </h3>
            <div className="space-y-2">
              {competitors.slice(0, 10).map((competitor) => (
                <div key={competitor.boat_id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-foreground">{competitor.boat_name}</h4>
                      {competitor.sail_number && (
                        <p className="text-xs text-muted-foreground">{competitor.sail_number}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          {competitor.shared_events}
                        </p>
                        <p className="text-[10px] text-muted-foreground">shared</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {competitor.wins}
                        </p>
                        <p className="text-[10px] text-muted-foreground">wins</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                          {competitor.losses}
                        </p>
                        <p className="text-[10px] text-muted-foreground">losses</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
