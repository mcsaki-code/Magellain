"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { useRouteStore } from "@/lib/store/route-store";
import type { PassageRoute } from "@/lib/store/route-store";
import type { Boat } from "@/lib/types";
import {
  Navigation,
  Sailboat,
  Clock,
  Loader2,
  AlertTriangle,
  MapPin,
  Route,
  Gauge,
  Timer,
  ArrowRight,
  Shield,
  Repeat,
  TrendingUp,
  Info,
  ChevronDown,
} from "lucide-react";

function degToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function formatDuration(hrs: number): string {
  if (hrs < 1) return `${Math.round(hrs * 60)}m`;
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getSailIcon(sail: string): string {
  if (sail.includes("spinnaker") || sail.includes("spin")) return "S";
  if (sail.includes("genoa") || sail.includes("gen")) return "G";
  if (sail.includes("jib")) return "J";
  if (sail.includes("storm")) return "!";
  return "M";
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case "low": return "text-green-600 dark:text-green-400";
    case "moderate": return "text-yellow-600 dark:text-yellow-400";
    case "high": return "text-orange-600 dark:text-orange-400";
    case "extreme": return "text-red-600 dark:text-red-400";
    default: return "text-muted-foreground";
  }
}

function getRiskBg(risk: string): string {
  switch (risk) {
    case "low": return "bg-green-500/10 border-green-500/30";
    case "moderate": return "bg-yellow-500/10 border-yellow-500/30";
    case "high": return "bg-orange-500/10 border-orange-500/30";
    case "extreme": return "bg-red-500/10 border-red-500/30";
    default: return "bg-muted/50 border-border";
  }
}

export default function RoutePlannerPage() {
  const {
    passages,
    selectedPassageId,
    selectedBoatId,
    departureTime,
    computation,
    isComputing,
    error,
    setPassages,
    setSelectedPassage,
    setSelectedBoat,
    setDepartureTime,
    computeRoute,
  } = useRouteStore();

  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassageList, setShowPassageList] = useState(false);
  const [showBoatList, setShowBoatList] = useState(false);
  const [showLegDetails, setShowLegDetails] = useState(false);

  // Load passages and boats
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Load boats for all users (both auth'd and anonymous) so route planner always works
      const [passagesRes, boatsRes] = await Promise.all([
        supabase
          .from("passage_routes")
          .select("*")
          .order("rhumb_line_distance_nm", { ascending: true }),
        supabase
          .from("boats")
          .select("*")
          .not("phrf_rating", "is", null)
          .order("name"),
      ]);

      if (passagesRes.data) {
        setPassages(passagesRes.data as PassageRoute[]);
        if (!selectedPassageId && passagesRes.data.length > 0) {
          setSelectedPassage(passagesRes.data[0].id);
        }
      }
      if (boatsRes.data && boatsRes.data.length > 0) {
        setBoats(boatsRes.data as Boat[]);
        if (!selectedBoatId) {
          const primary = (boatsRes.data as Boat[]).find((b) => b.is_primary);
          if (primary) {
            setSelectedBoat(primary.id);
          } else if (user) {
            const owned = (boatsRes.data as Boat[]).find((b) => b.owner_id === user.id);
            if (owned) {
              setSelectedBoat(owned.id);
            } else {
              // No primary or owned boat — select first available
              setSelectedBoat(boatsRes.data[0].id);
            }
          } else {
            // Anonymous user — select first available boat
            setSelectedBoat(boatsRes.data[0].id);
          }
        }
      }
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPassage = passages.find((p) => p.id === selectedPassageId);
  const selectedBoat = boats.find((b) => b.id === selectedBoatId);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <Header title="Route Planner" />
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-ocean" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Route Planner" />
      <div className="space-y-4 p-4">

        {/* Intro Card */}
        {!computation && (
          <section className="rounded-xl border border-ocean/20 bg-ocean/5 p-4">
            <div className="flex items-start gap-3">
              <Navigation className="mt-0.5 h-5 w-5 text-ocean" />
              <div>
                <h2 className="text-sm font-semibold">AI-Powered Route Planning</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select a passage and your boat. MagellAIn will compute the optimal route
                  based on current weather, wind forecasts, and your boat&apos;s performance polars.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Passage Selector */}
        <section className="rounded-xl border bg-card">
          <button
            onClick={() => setShowPassageList(!showPassageList)}
            className="flex w-full items-center gap-3 p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ocean/10">
              <Route className="h-5 w-5 text-ocean" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Passage</p>
              {selectedPassage ? (
                <p className="text-sm font-medium">
                  {selectedPassage.departure_name} to {selectedPassage.arrival_name}
                  {selectedPassage.rhumb_line_distance_nm && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {selectedPassage.rhumb_line_distance_nm} nm
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Select a passage...</p>
              )}
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPassageList ? "rotate-180" : ""}`} />
          </button>

          {showPassageList && (
            <div className="border-t px-2 pb-2">
              {passages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPassage(p.id);
                    setShowPassageList(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    p.id === selectedPassageId ? "bg-ocean/10" : "hover:bg-muted/50"
                  }`}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.departure_name} → {p.arrival_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.rhumb_line_distance_nm ? `${p.rhumb_line_distance_nm} nm` : ""}
                      {p.difficulty && ` · ${p.difficulty}`}
                      {p.waypoints?.length > 0 && ` · ${p.waypoints.length} waypoints`}
                    </p>
                  </div>
                  {p.id === selectedPassageId && (
                    <div className="h-2 w-2 rounded-full bg-ocean" />
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Boat Selector */}
        <section className="rounded-xl border bg-card">
          <button
            onClick={() => setShowBoatList(!showBoatList)}
            className="flex w-full items-center gap-3 p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ocean/10">
              <Sailboat className="h-5 w-5 text-ocean" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Boat</p>
              {selectedBoat ? (
                <p className="text-sm font-medium">
                  {selectedBoat.name}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {selectedBoat.class_name} · PHRF {selectedBoat.phrf_rating}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Select a boat...</p>
              )}
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showBoatList ? "rotate-180" : ""}`} />
          </button>

          {showBoatList && (
            <div className="border-t px-2 pb-2">
              {boats.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No boats with PHRF ratings available. Add a boat with a PHRF rating to use route planning.
                </p>
              ) : (
                boats.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBoat(b.id);
                      setShowBoatList(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      b.id === selectedBoatId ? "bg-ocean/10" : "hover:bg-muted/50"
                    }`}
                  >
                    <Sailboat className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.class_name} · PHRF {b.phrf_rating}
                        {b.sail_number && ` · #${b.sail_number}`}
                      </p>
                    </div>
                    {b.id === selectedBoatId && (
                      <div className="h-2 w-2 rounded-full bg-ocean" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </section>

        {/* Departure Time */}
        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ocean/10">
              <Clock className="h-5 w-5 text-ocean" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Departure</p>
              <input
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="mt-0.5 w-full rounded-md border-0 bg-transparent p-0 text-sm font-medium focus:ring-0"
              />
            </div>
          </div>
        </section>

        {/* Compute Button */}
        <button
          onClick={computeRoute}
          disabled={isComputing || !selectedPassageId || !selectedBoatId}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean px-6 py-3.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {isComputing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Computing optimal route...
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4" />
              Compute Route
            </>
          )}
        </button>

        {/* Help text when button is disabled */}
        {!isComputing && (!selectedPassageId || !selectedBoatId) && (
          <p className="text-center text-xs text-muted-foreground">
            {!selectedBoatId && boats.length === 0
              ? "Sign in and add a boat with a PHRF rating to compute routes"
              : !selectedPassageId
              ? "Select a passage above to get started"
              : "Select a boat above to compute a route"}
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* ─── RESULTS ─────────────────────────────────────────── */}
        {computation && (
          <>
            {/* Route Summary */}
            <section className="rounded-xl border bg-card overflow-hidden">
              <div className="border-b bg-ocean/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Route Summary</h3>
                  {computation.risk_level && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${getRiskBg(computation.risk_level)} ${getRiskColor(computation.risk_level)}`}>
                      {computation.risk_level} risk
                    </span>
                  )}
                </div>
                {selectedPassage && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedPassage.departure_name} → {selectedPassage.arrival_name}
                    {selectedBoat && ` · ${selectedBoat.name}`}
                  </p>
                )}
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-2 gap-px bg-border">
                <div className="flex items-center gap-3 bg-card p-3">
                  <Route className="h-5 w-5 shrink-0 text-ocean" />
                  <div>
                    <p className="text-lg font-bold">{computation.total_distance_nm} nm</p>
                    <p className="text-xs text-muted-foreground">Distance</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-card p-3">
                  <Timer className="h-5 w-5 shrink-0 text-ocean" />
                  <div>
                    <p className="text-lg font-bold">{formatDuration(computation.estimated_duration_hours ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Est. Duration</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-card p-3">
                  <Gauge className="h-5 w-5 shrink-0 text-ocean" />
                  <div>
                    <p className="text-lg font-bold">{computation.avg_speed_knots} kts</p>
                    <p className="text-xs text-muted-foreground">Avg Speed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-card p-3">
                  <Clock className="h-5 w-5 shrink-0 text-ocean" />
                  <div>
                    <p className="text-lg font-bold">
                      {computation.estimated_arrival
                        ? new Date(computation.estimated_arrival).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "--"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ETA{" "}
                      {computation.estimated_arrival &&
                        new Date(computation.estimated_arrival).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rhumb line comparison */}
              {computation.rhumb_line_distance_nm && (
                <div className="border-t px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Rhumb line: {computation.rhumb_line_distance_nm} nm
                      {computation.rhumb_line_duration_hours && ` · ${formatDuration(computation.rhumb_line_duration_hours)}`}
                      {computation.route_advantage_pct != null && computation.route_advantage_pct !== 0 && (
                        <span className={computation.route_advantage_pct > 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                          {" "}({computation.route_advantage_pct > 0 ? "+" : ""}{computation.route_advantage_pct}% via waypoints)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Risk Assessment */}
            {computation.risk_factors && computation.risk_factors.length > 0 && (
              <section className={`rounded-xl border p-4 ${getRiskBg(computation.risk_level)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`h-4 w-4 ${getRiskColor(computation.risk_level)}`} />
                  <h3 className="text-sm font-semibold">Risk Assessment</h3>
                </div>
                {computation.risk_factors.map((factor, i) => (
                  <p key={i} className="text-xs text-muted-foreground mt-1">
                    {factor}
                  </p>
                ))}
              </section>
            )}

            {/* Sail Changes */}
            {computation.sail_changes.length > 0 && (
              <section className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Repeat className="h-4 w-4 text-ocean" />
                  <h3 className="text-sm font-semibold">Sail Changes ({computation.sail_changes.length})</h3>
                </div>
                <div className="space-y-2">
                  {computation.sail_changes.map((change, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold">
                        {getSailIcon(change.from_sail)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-ocean/10 text-[10px] font-bold text-ocean">
                        {getSailIcon(change.to_sail)}
                      </span>
                      <span className="text-muted-foreground">
                        Leg {change.leg + 1}: {change.from_sail} → {change.to_sail}
                      </span>
                      <span className="ml-auto text-muted-foreground/60">{change.reason}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Leg-by-Leg Details */}
            <section className="rounded-xl border bg-card overflow-hidden">
              <button
                onClick={() => setShowLegDetails(!showLegDetails)}
                className="flex w-full items-center justify-between px-4 py-3 border-b"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ocean" />
                  <h3 className="text-sm font-semibold">Leg Details ({computation.legs?.length ?? 0} legs)</h3>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showLegDetails ? "rotate-180" : ""}`} />
              </button>

              {showLegDetails && computation.legs && (
                <div className="divide-y">
                  {computation.legs.map((leg, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium">
                          Leg {i + 1}
                          {leg.from.name && ` · ${leg.from.name}`}
                          {leg.to.name && ` → ${leg.to.name}`}
                        </p>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold">
                          {leg.sail_type}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div>
                          <p className="font-medium text-foreground">{leg.distance_nm} nm</p>
                          <p>Distance</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{formatDuration(leg.duration_hrs)}</p>
                          <p>Duration</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{leg.boat_speed_kts} kts</p>
                          <p>Boat speed</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {leg.tws_kts} kts @ {leg.twa_deg}°
                          </p>
                          <p>TWS/TWA</p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                        <span>BRG {leg.bearing_deg}° ({degToCompass(leg.bearing_deg)})</span>
                        <span>TWA {leg.twa_deg}° ({leg.twa_deg < 45 ? "close-hauled" : leg.twa_deg < 70 ? "close reach" : leg.twa_deg < 110 ? "beam reach" : leg.twa_deg < 150 ? "broad reach" : "running"})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Weather Context */}
            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground">WEATHER DATA</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Route computed using {computation.weather_data?.observations_used ?? 0} weather observations
                from {computation.weather_data?.stations_available ?? 0} stations.
                Wind estimates interpolated from nearest reporting stations.
                {computation.computation_time_ms && (
                  <span> Computed in {computation.computation_time_ms}ms.</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                For best results, run routing close to your actual departure time when weather data is freshest.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
