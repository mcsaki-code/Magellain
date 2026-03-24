"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Calendar, MapPin, ChevronRight, Loader2, Medal, Download } from "lucide-react";
import type { Regatta, Race, Club, Boat } from "@/lib/types";
import { exportSeriesStandingsPDF } from "@/lib/utils/pdf-export";

const USER_BOAT_ID = "d3099269-e402-4c95-b47a-74cd1bb4164c"; // Impetuous

interface RaceResult {
  id: string;
  race_id: string;
  boat_id: string;
  fleet: string;
  finish_position: number | null;
  corrected_position: number | null;
  elapsed_time_sec: number | null;
  corrected_time_sec: number | null;
  status: string;
  boat?: Boat;
}

interface RaceWithResults extends Race {
  results?: RaceResult[];
}

interface RegattaWithClub extends Regatta {
  club?: Club;
  races?: RaceWithResults[];
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    in_progress: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    completed: "bg-muted text-muted-foreground",
    abandoned: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    postponed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? styles.scheduled}`}>
      {status.replace("_", " ")}
    </span>
  );
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

interface BoatStanding {
  boat_id: string;
  boat_name: string;
  sail_number: string | null;
  total_points: number;
  races_sailed: number;
}

function computeStandings(races: RaceWithResults[]): Record<string, BoatStanding[]> {
  const standingsByFleet: Record<string, Record<string, BoatStanding>> = {};

  // Accumulate points from all races
  for (const race of races) {
    if (!race.results) continue;
    for (const result of race.results) {
      if (!result.corrected_position) continue;

      if (!standingsByFleet[result.fleet]) {
        standingsByFleet[result.fleet] = {};
      }

      const key = result.boat_id;
      if (!standingsByFleet[result.fleet][key]) {
        standingsByFleet[result.fleet][key] = {
          boat_id: result.boat_id,
          boat_name: result.boat?.name ?? "Unknown",
          sail_number: result.boat?.sail_number ?? null,
          total_points: 0,
          races_sailed: 0,
        };
      }

      standingsByFleet[result.fleet][key].total_points += result.corrected_position;
      standingsByFleet[result.fleet][key].races_sailed += 1;
    }
  }

  // Sort each fleet by total points and convert to array
  const result: Record<string, BoatStanding[]> = {};
  for (const [fleet, boats] of Object.entries(standingsByFleet)) {
    result[fleet] = Object.values(boats).sort((a, b) => a.total_points - b.total_points);
  }

  return result;
}

export default function RacesPage() {
  const [regattas, setRegattas] = useState<RegattaWithClub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRegatta, setSelectedRegatta] = useState<string | null>(null);

  useEffect(() => {
    async function loadRegattas() {
      const supabase = createClient();

      // Fetch regattas with their clubs
      const { data: regattaData } = await supabase
        .from("regattas")
        .select("*, clubs(*)")
        .eq("is_active", true)
        .order("start_date", { ascending: true });

      if (regattaData) {
        const mapped = regattaData.map((r: Record<string, unknown>) => ({
          ...r,
          club: r.clubs as unknown as Club,
        })) as RegattaWithClub[];
        setRegattas(mapped);
      }

      setIsLoading(false);
    }

    loadRegattas();
  }, []);

  // Load races and results when a regatta is selected
  useEffect(() => {
    if (!selectedRegatta) return;

    async function loadRaces() {
      const supabase = createClient();
      const { data: raceData } = await supabase
        .from("races")
        .select("*")
        .eq("regatta_id", selectedRegatta)
        .order("race_number", { ascending: true });

      if (raceData) {
        // Load results for completed races
        const completedRaceIds = raceData
          .filter((r: Record<string, unknown>) => r.status === "completed")
          .map((r: Record<string, unknown>) => r.id as string);

        let resultsMap: Record<string, RaceResult[]> = {};
        if (completedRaceIds.length > 0) {
          const { data: results } = await supabase
            .from("race_results")
            .select("*, boat:boats(id, name, class_name, sail_number)")
            .in("race_id", completedRaceIds)
            .order("corrected_position", { ascending: true });

          if (results) {
            for (const r of results) {
              const raceId = r.race_id as string;
              if (!resultsMap[raceId]) resultsMap[raceId] = [];
              resultsMap[raceId].push({
                ...r,
                boat: (r as Record<string, unknown>).boat as Boat | undefined,
              } as RaceResult);
            }
          }
        }

        const racesWithResults: RaceWithResults[] = raceData.map((r: Record<string, unknown>) => ({
          ...r,
          results: resultsMap[(r.id as string)] ?? [],
        })) as RaceWithResults[];

        setRegattas((prev) =>
          prev.map((reg) =>
            reg.id === selectedRegatta ? { ...reg, races: racesWithResults } : reg
          )
        );
      }
    }

    loadRaces();
  }, [selectedRegatta]);

  const upcomingRegattas = regattas.filter(
    (r) => new Date(r.end_date) >= new Date()
  );
  const pastRegattas = regattas.filter(
    (r) => new Date(r.end_date) < new Date()
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Races" />
      <div className="space-y-4 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : regattas.length === 0 ? (
          <div className="py-12 text-center">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No regattas scheduled yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Race schedules from FYC and WSSC will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Upcoming */}
            {upcomingRegattas.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">UPCOMING</h2>
                {upcomingRegattas.map((regatta) => (
                  <RegattaCard
                    key={regatta.id}
                    regatta={regatta}
                    isExpanded={selectedRegatta === regatta.id}
                    onToggle={() =>
                      setSelectedRegatta(selectedRegatta === regatta.id ? null : regatta.id)
                    }
                  />
                ))}
              </div>
            )}

            {/* Past */}
            {pastRegattas.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">PAST REGATTAS</h2>
                {pastRegattas.map((regatta) => (
                  <RegattaCard
                    key={regatta.id}
                    regatta={regatta}
                    isExpanded={selectedRegatta === regatta.id}
                    onToggle={() =>
                      setSelectedRegatta(selectedRegatta === regatta.id ? null : regatta.id)
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StandingsSection({ races, regattaName }: { races: RaceWithResults[]; regattaName?: string }) {
  const standings = computeStandings(races);
  const fleets = Object.keys(standings).sort();

  if (fleets.length === 0) return null;

  function handleExportStandings() {
    const pdfData: Record<string, Array<{ place: number; boat_name: string; sail_number: string; total_points: number; races_sailed: number }>> = {};
    for (const fleet of fleets) {
      pdfData[fleet] = standings[fleet].map((boat, idx) => ({
        place: idx + 1,
        boat_name: boat.boat_name,
        sail_number: boat.sail_number || "",
        total_points: boat.total_points,
        races_sailed: boat.races_sailed,
      }));
    }
    exportSeriesStandingsPDF(regattaName || "Series", pdfData);
  }

  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">STANDINGS</p>
        <button
          onClick={handleExportStandings}
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Export standings as PDF"
        >
          <Download className="h-3 w-3" />
          PDF
        </button>
      </div>
      <div className="space-y-3">
        {fleets.map((fleet) => (
          <div key={fleet} className="rounded-lg border bg-muted/20 p-2.5">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{fleet}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="px-1 py-1 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-1 py-1 text-left font-medium text-muted-foreground">Boat</th>
                    <th className="px-1 py-1 text-left font-medium text-muted-foreground">Sail</th>
                    <th className="px-1 py-1 text-center font-medium text-muted-foreground">Points</th>
                    <th className="px-1 py-1 text-center font-medium text-muted-foreground">Races</th>
                  </tr>
                </thead>
                <tbody>
                  {standings[fleet].map((boat, idx) => {
                    const isUserBoat = boat.boat_id === USER_BOAT_ID;
                    return (
                      <tr
                        key={boat.boat_id}
                        className={`border-b border-border/20 text-xs ${
                          isUserBoat ? "bg-blue-50 dark:bg-blue-950/30" : ""
                        }`}
                      >
                        <td className="px-1 py-1.5 font-medium text-muted-foreground">{idx + 1}</td>
                        <td className="px-1 py-1.5 font-medium">{boat.boat_name}</td>
                        <td className="px-1 py-1.5 text-muted-foreground">{boat.sail_number ?? "—"}</td>
                        <td className="px-1 py-1.5 text-center font-semibold">{boat.total_points}</td>
                        <td className="px-1 py-1.5 text-center text-muted-foreground">{boat.races_sailed}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegattaCard({
  regatta,
  isExpanded,
  onToggle,
}: {
  regatta: RegattaWithClub;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ocean/10">
          <Trophy className="h-5 w-5 text-ocean" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{regatta.name}</h3>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(regatta.start_date)} - {formatDate(regatta.end_date)}
            </span>
            {regatta.club && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {regatta.club.short_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {regatta.series_type}
          </span>
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-4 pb-4 pt-3">
          {regatta.description && (
            <p className="mb-3 text-sm text-muted-foreground">{regatta.description}</p>
          )}
          {regatta.fleets && regatta.fleets.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {regatta.fleets.map((fleet) => (
                <span
                  key={fleet}
                  className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-medium text-navy-700 dark:bg-navy-800 dark:text-navy-300"
                >
                  {fleet}
                </span>
              ))}
            </div>
          )}

          {/* Races list */}
          {regatta.races && regatta.races.length > 0 ? (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">RACES</p>
                {regatta.races.map((race) => {
                  const raceWithResults = race as RaceWithResults;
                  const results = raceWithResults.results ?? [];
                  // Group winners by fleet
                  const fleetWinners: Record<string, RaceResult> = {};
                  for (const r of results) {
                    if (r.corrected_position === 1 || (r.finish_position === 1 && !r.corrected_position)) {
                      if (!fleetWinners[r.fleet]) fleetWinners[r.fleet] = r;
                    }
                  }
                  const winners = Object.entries(fleetWinners);

                  return (
                    <div key={race.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium">Race {race.race_number}</span>
                          {race.course_type && (
                            <span className="ml-2 text-xs text-muted-foreground">{race.course_type}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {race.wind_speed_avg_kts && (
                            <span className="text-xs text-muted-foreground">
                              {race.wind_speed_avg_kts} kts
                            </span>
                          )}
                          <StatusBadge status={race.status} />
                        </div>
                      </div>
                      {/* Winners */}
                      {winners.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                          {winners.map(([fleet, result]) => (
                            <div key={fleet} className="flex items-center gap-2 text-xs">
                              <Medal className="h-3.5 w-3.5 text-yellow-500" />
                              <span className="font-medium">{fleet}:</span>
                              <span className="text-muted-foreground">
                                {result.boat?.name ?? "Unknown"}{" "}
                                {result.boat?.sail_number ? `(${result.boat.sail_number})` : ""}
                                {result.elapsed_time_sec ? ` \u2014 ${formatElapsed(result.elapsed_time_sec)}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Show top 3 if we have results but listed separately */}
                      {results.length > 0 && winners.length === 0 && (
                        <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                          {results.slice(0, 3).map((r, i) => (
                            <div key={r.id} className="flex items-center gap-2 text-xs">
                              <span className="w-4 text-center font-bold text-muted-foreground">{i + 1}</span>
                              <span className="text-muted-foreground">
                                {r.boat?.name ?? "Unknown"}{" "}
                                {r.boat?.sail_number ? `(${r.boat.sail_number})` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Standings */}
              <StandingsSection races={regatta.races} regattaName={regatta.name} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No races posted yet</p>
          )}
        </div>
      )}
    </div>
  );
}
