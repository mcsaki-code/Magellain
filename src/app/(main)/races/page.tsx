"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Calendar, MapPin, ChevronRight, Loader2 } from "lucide-react";
import type { Regatta, Race, Club } from "@/lib/types";

interface RegattaWithClub extends Regatta {
  club?: Club;
  races?: Race[];
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

  // Load races when a regatta is selected
  useEffect(() => {
    if (!selectedRegatta) return;

    async function loadRaces() {
      const supabase = createClient();
      const { data } = await supabase
        .from("races")
        .select("*")
        .eq("regatta_id", selectedRegatta)
        .order("race_number", { ascending: true });

      if (data) {
        setRegattas((prev) =>
          prev.map((r) =>
            r.id === selectedRegatta ? { ...r, races: data as Race[] } : r
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
    <div className="flex flex-col">
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
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">RACES</p>
              {regatta.races.map((race) => (
                <div
                  key={race.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
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
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No races posted yet</p>
          )}
        </div>
      )}
    </div>
  );
}
