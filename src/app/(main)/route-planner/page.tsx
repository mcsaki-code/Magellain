"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { useRouteStore, computeTotalDistance, computeBearing } from "@/lib/store/route-store";
import type { PassageRoute, Waypoint } from "@/lib/store/route-store";
import type { Boat } from "@/lib/types";
import RouteCreator from "@/components/route/route-creator";
import MyRoutesPanel from "@/components/route/my-routes-panel";
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
  ChevronUp,
  List,
  Plus,
  BarChart3,
  Map as MapIcon,
  X,
} from "lucide-react";

// Lazy-load map to avoid SSR issues with mapbox-gl
const RouteMapView = dynamic(
  () => import("@/components/route/route-map-view"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-muted">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ocean border-t-transparent" />
      </div>
    ),
  }
);

// ─── Helper Functions ─────────────────────────────────────

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

// ─── Bottom Sheet ─────────────────────────────────────────
// Draggable bottom sheet for mobile, shows panel content over the map

function BottomSheet({
  children,
  isExpanded,
  onToggle,
  title,
}: {
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-20 rounded-t-2xl border-t bg-background shadow-lg transition-all duration-300 ${
        isExpanded ? "max-h-[70vh]" : "max-h-[140px]"
      }`}
    >
      {/* Handle bar */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-center py-2"
      >
        <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">{title}</p>
        <button onClick={onToggle} className="text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className={`overflow-y-auto px-4 pb-4 ${isExpanded ? "max-h-[calc(70vh-60px)]" : "max-h-[80px]"}`}>
        {children}
      </div>
    </div>
  );
}

// ─── Compute Panel (boat selector + departure + results) ─

function ComputePanel({
  boats,
  selectedBoat,
  selectedPassage,
  compact,
}: {
  boats: Boat[];
  selectedBoat: Boat | undefined;
  selectedPassage: PassageRoute | undefined;
  compact?: boolean;
}) {
  const {
    selectedPassageId,
    selectedBoatId,
    departureTime,
    computation,
    isComputing,
    error,
    setSelectedBoat,
    setDepartureTime,
    computeRoute,
  } = useRouteStore();

  const [showBoatList, setShowBoatList] = useState(false);
  const [showLegDetails, setShowLegDetails] = useState(false);

  return (
    <div className="space-y-3">
      {/* Selected Route Summary */}
      {selectedPassage && (
        <div className="flex items-center gap-2 rounded-lg border border-ocean/20 bg-ocean/5 p-2.5">
          <Route className="h-4 w-4 text-ocean shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{selectedPassage.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {selectedPassage.departure_name} &rarr; {selectedPassage.arrival_name}
              {selectedPassage.rhumb_line_distance_nm && ` · ${selectedPassage.rhumb_line_distance_nm} nm`}
            </p>
          </div>
        </div>
      )}

      {!selectedPassage && (
        <div className="rounded-lg border border-dashed border-muted-foreground/20 p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Select a route to compute</p>
        </div>
      )}

      {/* Boat Selector */}
      <div className="rounded-lg border bg-card">
        <button
          onClick={() => setShowBoatList(!showBoatList)}
          className="flex w-full items-center gap-2.5 p-3"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ocean/10">
            <Sailboat className="h-4 w-4 text-ocean" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Boat</p>
            {selectedBoat ? (
              <p className="text-xs font-medium">
                {selectedBoat.name}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  PHRF {selectedBoat.phrf_rating}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Select a boat...</p>
            )}
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showBoatList ? "rotate-180" : ""}`} />
        </button>

        {showBoatList && (
          <div className="border-t px-1.5 pb-1.5 max-h-40 overflow-y-auto">
            {boats.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedBoat(b.id);
                  setShowBoatList(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${
                  b.id === selectedBoatId ? "bg-ocean/10" : "hover:bg-muted/50"
                }`}
              >
                <Sailboat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {b.class_name} · PHRF {b.phrf_rating}
                  </p>
                </div>
                {b.id === selectedBoatId && <div className="h-1.5 w-1.5 rounded-full bg-ocean" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Departure Time */}
      <div className="flex items-center gap-2.5 rounded-lg border bg-card p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ocean/10">
          <Clock className="h-4 w-4 text-ocean" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Departure</p>
          <input
            type="datetime-local"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="mt-0.5 w-full rounded-md border-0 bg-transparent p-0 text-xs font-medium focus:ring-0"
          />
        </div>
      </div>

      {/* Compute Button */}
      <button
        onClick={computeRoute}
        disabled={isComputing || !selectedPassageId || !selectedBoatId}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean px-4 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {isComputing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Computing...
          </>
        ) : (
          <>
            <Navigation className="h-4 w-4" />
            Compute Route
          </>
        )}
      </button>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ─── RESULTS ─────────────────────────────────────── */}
      {computation && (
        <>
          {/* Route Summary */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="border-b bg-ocean/5 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold">Route Summary</h3>
                {computation.risk_level && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getRiskBg(computation.risk_level)} ${getRiskColor(computation.risk_level)}`}>
                    {computation.risk_level}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="flex items-center gap-2 bg-card p-2.5">
                <Route className="h-4 w-4 shrink-0 text-ocean" />
                <div>
                  <p className="text-sm font-bold">{computation.total_distance_nm} nm</p>
                  <p className="text-[10px] text-muted-foreground">Distance</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-card p-2.5">
                <Timer className="h-4 w-4 shrink-0 text-ocean" />
                <div>
                  <p className="text-sm font-bold">{formatDuration(computation.estimated_duration_hours ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Duration</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-card p-2.5">
                <Gauge className="h-4 w-4 shrink-0 text-ocean" />
                <div>
                  <p className="text-sm font-bold">{computation.avg_speed_knots} kts</p>
                  <p className="text-[10px] text-muted-foreground">Avg Speed</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-card p-2.5">
                <Clock className="h-4 w-4 shrink-0 text-ocean" />
                <div>
                  <p className="text-sm font-bold">
                    {computation.estimated_arrival
                      ? new Date(computation.estimated_arrival).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                      : "--"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    ETA{" "}
                    {computation.estimated_arrival &&
                      new Date(computation.estimated_arrival).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            </div>

            {computation.rhumb_line_distance_nm && (
              <div className="border-t px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground">
                    Rhumb line: {computation.rhumb_line_distance_nm} nm
                    {computation.route_advantage_pct != null && computation.route_advantage_pct !== 0 && (
                      <span className={computation.route_advantage_pct > 0 ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                        {" "}({computation.route_advantage_pct > 0 ? "+" : ""}{computation.route_advantage_pct}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Risk */}
          {computation.risk_factors && computation.risk_factors.length > 0 && (
            <div className={`rounded-lg border p-3 ${getRiskBg(computation.risk_level)}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield className={`h-3.5 w-3.5 ${getRiskColor(computation.risk_level)}`} />
                <h3 className="text-xs font-semibold">Risk</h3>
              </div>
              {computation.risk_factors.map((f: string, i: number) => (
                <p key={i} className="text-[10px] text-muted-foreground mt-0.5">{f}</p>
              ))}
            </div>
          )}

          {/* Sail Changes */}
          {computation.sail_changes.length > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Repeat className="h-3.5 w-3.5 text-ocean" />
                <h3 className="text-xs font-semibold">Sail Changes ({computation.sail_changes.length})</h3>
              </div>
              <div className="space-y-1.5">
                {computation.sail_changes.map((change: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-muted text-[8px] font-bold">{getSailIcon(change.from_sail)}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-ocean/10 text-[8px] font-bold text-ocean">{getSailIcon(change.to_sail)}</span>
                    <span className="text-muted-foreground">Leg {change.leg + 1}</span>
                    <span className="ml-auto text-muted-foreground/60">{change.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leg Details */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <button
              onClick={() => setShowLegDetails(!showLegDetails)}
              className="flex w-full items-center justify-between px-3 py-2.5 border-b"
            >
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-ocean" />
                <h3 className="text-xs font-semibold">Legs ({computation.legs?.length ?? 0})</h3>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showLegDetails ? "rotate-180" : ""}`} />
            </button>

            {showLegDetails && computation.legs && (
              <div className="divide-y max-h-60 overflow-y-auto">
                {computation.legs.map((leg: any, i: number) => (
                  <div key={i} className="px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium">
                        Leg {i + 1} {leg.to.name && `\u2192 ${leg.to.name}`}
                      </p>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold">{leg.sail_type}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-[10px] text-muted-foreground">
                      <div>
                        <p className="font-medium text-foreground">{leg.distance_nm} nm</p>
                        <p>Dist</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{formatDuration(leg.duration_hrs)}</p>
                        <p>Time</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{leg.boat_speed_kts} kts</p>
                        <p>Speed</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{leg.tws_kts}@{leg.twa_deg}\u00b0</p>
                        <p>TWS/TWA</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weather info */}
          <div className="rounded-lg border bg-card p-3">
            <p className="text-[10px] text-muted-foreground">
              Computed from {computation.weather_data?.observations_used ?? 0} observations / {computation.weather_data?.stations_available ?? 0} stations
              {computation.computation_time_ms && ` in ${computation.computation_time_ms}ms`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Route Planner Page ──────────────────────────────

export default function RoutePlannerPage() {
  const {
    passages,
    selectedPassageId,
    selectedBoatId,
    computation,
    creationMode,
    activeTab,
    setPassages,
    setSelectedPassage,
    setSelectedBoat,
    setActiveTab,
    loadRoutes,
    startCreating,
  } = useRouteStore();

  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(true);

  // Load data
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsSignedIn(!!user);

      try {
        const res = await fetch("/api/routes");
        if (res.ok) {
          const data = await res.json();
          useRouteStore.getState().setPassages(data.routes as PassageRoute[]);
          if (!selectedPassageId && data.routes.length > 0) {
            setSelectedPassage(data.routes[0].id);
          }
        } else {
          throw new Error("API not available");
        }
      } catch {
        const { data: passagesData } = await supabase
          .from("passage_routes")
          .select("*")
          .order("rhumb_line_distance_nm", { ascending: true });
        if (passagesData) {
          setPassages(passagesData as PassageRoute[]);
          if (!selectedPassageId && passagesData.length > 0) {
            setSelectedPassage(passagesData[0].id);
          }
        }
      }

      const { data: boatsData } = await supabase
        .from("boats")
        .select("*")
        .not("phrf_rating", "is", null)
        .order("name");

      if (boatsData && boatsData.length > 0) {
        setBoats(boatsData as Boat[]);
        if (!selectedBoatId) {
          const primary = (boatsData as Boat[]).find((b: any) => b.is_primary);
          if (primary) {
            setSelectedBoat(primary.id);
          } else if (user) {
            const owned = (boatsData as Boat[]).find((b: any) => b.owner_id === user.id);
            if (owned) setSelectedBoat(owned.id);
            else setSelectedBoat(boatsData[0].id);
          } else {
            setSelectedBoat(boatsData[0].id);
          }
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const selectedPassage = passages.find((p) => p.id === selectedPassageId);
  const selectedBoat = boats.find((b) => b.id === selectedBoatId);

  const handleTabChange = useCallback(
    (tab: "routes" | "create" | "results") => {
      if (tab === "create" && creationMode === "idle") {
        startCreating();
      } else {
        setActiveTab(tab);
      }
      setSheetExpanded(true);
    },
    [creationMode, startCreating, setActiveTab]
  );

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Route Planner" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ocean" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - var(--nav-total-height))" }}>
      <Header title="Route Planner" />

      {/* Tab Bar */}
      <div className="flex border-b shrink-0">
        {(
          [
            { key: "routes" as const, label: "Routes", icon: List },
            { key: "create" as const, label: "Create", icon: Plus },
            ...(computation
              ? [{ key: "results" as const, label: "Results", icon: BarChart3 }]
              : []),
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === key
                ? "border-b-2 border-ocean text-ocean"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Map + Bottom Sheet Layout */}
      <div className="relative flex-1 overflow-hidden">
        {/* Map fills the entire space */}
        <RouteMapView />

        {/* Bottom Sheet with panel content */}
        <BottomSheet
          isExpanded={sheetExpanded}
          onToggle={() => setSheetExpanded(!sheetExpanded)}
          title={
            activeTab === "routes"
              ? "Routes"
              : activeTab === "create"
              ? creationMode === "editing" ? "Edit Route" : "Create Route"
              : "Results"
          }
        >
          {/* Routes Tab */}
          {activeTab === "routes" && (
            <div className="space-y-3">
              <MyRoutesPanel />
              {selectedPassageId && (
                <ComputePanel
                  boats={boats}
                  selectedBoat={selectedBoat}
                  selectedPassage={selectedPassage}
                  compact
                />
              )}
            </div>
          )}

          {/* Create Tab */}
          {activeTab === "create" && (
            isSignedIn ? (
              <RouteCreator />
            ) : (
              <div className="text-center py-6">
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium">Sign in to create routes</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Create custom routes, optimize with AI, and share with your fleet.
                </p>
              </div>
            )
          )}

          {/* Results Tab */}
          {activeTab === "results" && computation && (
            <ComputePanel
              boats={boats}
              selectedBoat={selectedBoat}
              selectedPassage={selectedPassage}
              compact
            />
          )}
        </BottomSheet>
      </div>
    </div>
  );
}
