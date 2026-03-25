"use client";

/**
 * MapBottomDrawer
 *
 * Single unified bottom-of-map drawer that replaces the four independently
 * floating panels (CoursePanel, GpsTracker, RaceTimer, TrackReplay).
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │  Panel content (expands upward, max 55dvh)│
 *   ├──────────────────────────────────────────┤
 *   │  Tab bar: [Courses] [GPS ●] [Timer 4:55] │  ← always visible
 *   └──────────────────────────────────────────┘
 *
 * GPS recording and Race Timer state persist even when their tab is not
 * active — the panels stay mounted (CSS hidden), so watches/intervals
 * keep running in the background.
 */

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useMapStore } from "@/lib/store/map-store";
import {
  Route, Navigation, Flag, ChevronDown,
  Play, Square, Pause, RotateCcw, Save,
  Timer, Gauge, MapPin, Ruler, Compass,
  Sparkles, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackPoint } from "@/lib/store/map-store";

// ─── Types shared across tabs ─────────────────────────────────────

type DrawerTab = "courses" | "gps" | "timer";

interface RaceMark {
  id: string; name: string; short_name: string;
  description: string | null; latitude: number; longitude: number;
  mark_type: string; color: string | null;
}
interface CourseLeg {
  leg_order: number; rounding: string; notes: string | null; mark: RaceMark;
}
interface RaceCourse {
  id: string; name: string; short_name: string | null;
  description: string | null; course_type: string; distance_nm: number | null;
}
interface GpsPoint {
  lat: number; lng: number; ts: number;
  speed_kts: number | null; heading: number | null;
}

type TimerPhase = "WARNING" | "PREP" | "ONE MIN" | "RACING" | "FINISHED" | "IDLE";

// ─── Helpers ─────────────────────────────────────────────────────

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number) {
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

function fmtDur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtTime(ms: number) {
  const sign = ms < 0 ? "-" : "";
  const total = Math.floor(Math.abs(ms) / 1000);
  return `${sign}${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function computePhase(target: number | null): { phase: TimerPhase; remainingMs: number } {
  if (target === null) return { phase: "IDLE", remainingMs: 0 };
  const rem = target - Date.now();
  if (rem > 240_000) return { phase: "WARNING", remainingMs: rem };
  if (rem > 60_000)  return { phase: "PREP",    remainingMs: rem };
  if (rem > 0)       return { phase: "ONE MIN",  remainingMs: rem };
  if (rem > -3_600_000) return { phase: "RACING", remainingMs: rem };
  return { phase: "FINISHED", remainingMs: rem };
}

// ─── Main Component ───────────────────────────────────────────────

export function MapBottomDrawer() {
  const [activeTab, setActiveTab] = useState<DrawerTab | null>(null);
  const { setDrawerActiveTab } = useMapStore();

  const toggle = (tab: DrawerTab) => {
    const newTab = activeTab === tab ? null : tab;
    setActiveTab(newTab);
    setDrawerActiveTab(newTab);
  };

  // ── GPS state ──────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [gpsPoints, setGpsPoints] = useState<GpsPoint[]>([]);
  const [gpsElapsed, setGpsElapsed] = useState(0);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const [gpsSaved, setGpsSaved] = useState(false);
  const [gpsSaving, setGpsSaving] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const gpsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const gpsPointsRef = useRef<GpsPoint[]>([]);
  useEffect(() => { gpsPointsRef.current = gpsPoints; }, [gpsPoints]);

  const stopRecording = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (gpsTimerRef.current) { clearInterval(gpsTimerRef.current); gpsTimerRef.current = null; }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    setGpsError(null); setGpsSaved(false); setGpsPoints([]); gpsPointsRef.current = [];
    setGpsElapsed(0); setGpsSpeed(null); startTimeRef.current = Date.now();
    gpsTimerRef.current = setInterval(
      () => setGpsElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)),
      1000,
    );
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const kts = pos.coords.speed != null ? Math.round(pos.coords.speed * 1.944 * 10) / 10 : null;
        setGpsSpeed(kts);
        setGpsPoints((prev) => [...prev, {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          ts: pos.timestamp, speed_kts: kts, heading: pos.coords.heading,
        }]);
      },
      (err) => {
        stopRecording();
        setGpsError(err.code === err.PERMISSION_DENIED
          ? "Location access denied — check browser settings."
          : "GPS unavailable — check device location settings.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    setIsRecording(true);
  }, [stopRecording]);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    if (gpsTimerRef.current) clearInterval(gpsTimerRef.current);
  }, []);

  const gpsStats = useMemo(() => {
    const pts = gpsPoints;
    if (pts.length < 2) return null;
    let dist = 0;
    for (let i = 1; i < pts.length; i++) dist += haversineNm(pts[i-1].lat, pts[i-1].lng, pts[i].lat, pts[i].lng);
    const speeds = pts.filter((p) => p.speed_kts != null).map((p) => p.speed_kts as number);
    return {
      distanceNm: Math.round(dist * 100) / 100,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
      avgSpeed: speeds.length > 0 ? Math.round((speeds.reduce((a, b) => a + b) / speeds.length) * 10) / 10 : 0,
    };
  }, [gpsPoints]);

  const handleGpsSave = async () => {
    if (gpsPoints.length < 2) return;
    setGpsSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const track = { points: gpsPoints, stats: gpsStats, savedAt: new Date().toISOString() };
        const existing = JSON.parse(localStorage.getItem("magellain-gps-tracks") || "[]");
        existing.unshift(track);
        localStorage.setItem("magellain-gps-tracks", JSON.stringify(existing.slice(0, 10)));
      } else {
        const { data: boat } = await supabase.from("boats").select("id")
          .eq("owner_id", user.id).eq("is_primary", true).single();
        await supabase.from("gps_tracks").insert({
          user_id: user.id, boat_id: boat?.id || null,
          name: `Track ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
          started_at: new Date(gpsPoints[0].ts).toISOString(),
          ended_at: new Date(gpsPoints[gpsPoints.length - 1].ts).toISOString(),
          duration_sec: gpsElapsed,
          distance_nm: gpsStats?.distanceNm ?? 0,
          max_speed_kts: gpsStats?.maxSpeed ?? 0,
          avg_speed_kts: gpsStats?.avgSpeed ?? 0,
          track_points: gpsPoints.map((p) => ({
            lat: p.lat, lng: p.lng,
            timestamp: p.ts,
            speed_kts: p.speed_kts,
            heading: p.heading,
          })) satisfies TrackPoint[],
        });
      }
      setGpsSaved(true);
    } catch { setGpsError("Could not save track. Try again."); }
    finally { setGpsSaving(false); }
  };

  // ── Timer state ────────────────────────────────────────────────────
  const [timerTarget, setTimerTarget] = useState<number | null>(null);
  const [timerPlaying, setTimerPlaying] = useState(false);
  const [, forceTimerRender] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const prevPhaseRef = useRef<TimerPhase>("IDLE");

  const { phase: timerPhase, remainingMs } = computePhase(timerTarget);

  const playBeeps = useCallback((freq: number, count: number, dur: number, gap: number) => {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      for (let i = 0; i < count; i++) {
        const t = now + (dur / 1000 + gap / 1000) * i;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + dur / 1000);
        osc.start(t); osc.stop(t + dur / 1000);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (timerPhase !== prevPhaseRef.current && timerPlaying) {
      if (timerPhase === "WARNING" || timerPhase === "PREP") playBeeps(440, 3, 100, 200);
      else if (timerPhase === "ONE MIN") playBeeps(880, 6, 80, 120);
      else if (timerPhase === "RACING") playBeeps(880, 1, 1200, 0);
      prevPhaseRef.current = timerPhase;
    }
  }, [timerPhase, timerPlaying, playBeeps]);

  useEffect(() => {
    if (!timerPlaying || timerTarget === null) return;
    timerIntervalRef.current = setInterval(() => forceTimerRender((n) => n + 1), 100);
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [timerPlaying, timerTarget]);

  const handleStart5Min = () => {
    setTimerTarget(Date.now() + 5 * 60 * 1000);
    setTimerPlaying(true);
    prevPhaseRef.current = "IDLE";
  };
  const handleTimerSync = () => {
    setTimerTarget(Date.now());
    setTimerPlaying(true);
    prevPhaseRef.current = "IDLE";
    playBeeps(880, 1, 1200, 0);
  };
  const handleTimerReset = () => {
    setTimerTarget(null);
    setTimerPlaying(false);
    prevPhaseRef.current = "IDLE";
  };

  const timerPhaseColor = {
    WARNING: "text-yellow-400", PREP: "text-orange-400",
    "ONE MIN": "text-red-500", RACING: "text-green-400",
    FINISHED: "text-muted-foreground", IDLE: "text-muted-foreground",
  }[timerPhase];

  // ── Courses state ──────────────────────────────────────────────────
  const [courses, setCourses] = useState<RaceCourse[]>([]);
  const [marks, setMarks] = useState<RaceMark[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const { selectedCourse, setSelectedCourse, courseLegs, setCourseLegs,
          showCourseOverlay, toggleCourseOverlay, showTacticalAnalysis, setShowTacticalAnalysis } = useMapStore();

  useEffect(() => {
    if (courses.length > 0) return; // already loaded
    setCoursesLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("race_courses").select("*").eq("is_active", true).order("name"),
      supabase.from("race_marks").select("*").eq("is_active", true).order("short_name"),
    ]).then(([cr, mr]) => {
      if (cr.data) setCourses(cr.data);
      if (mr.data) setMarks(mr.data);
      setCoursesLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCourse || marks.length === 0) { setCourseLegs([]); return; }
    const supabase = createClient();
    supabase.from("course_legs")
      .select("leg_order, rounding, notes, mark_id")
      .eq("course_id", selectedCourse.id)
      .order("leg_order")
      .then(({ data }) => {
        if (!data) return;
        const legs = data
          .map((leg: { leg_order: number; rounding: string; notes: string | null; mark_id: string }) => {
            const mark = marks.find((m) => m.id === leg.mark_id);
            return mark ? { leg_order: leg.leg_order, rounding: leg.rounding, notes: leg.notes, mark } : null;
          })
          .filter(Boolean) as CourseLeg[];
        setCourseLegs(legs);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, marks]);

  // ─── Tab bar status helpers ──────────────────────────────────────

  const timerIsActive = timerTarget !== null && timerPlaying;
  const timerLabel = timerIsActive
    ? timerPhase === "RACING" ? `+${fmtTime(remainingMs)}` : fmtTime(remainingMs)
    : "Timer";

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="absolute inset-0 bottom-auto z-20 flex flex-col justify-end pointer-events-none">

      {/* Backdrop — tap to dismiss */}
      {activeTab && (
        <div
          className="absolute inset-0 pointer-events-auto"
          onClick={() => { setActiveTab(null); setDrawerActiveTab(null); }}
        />
      )}

      {/* ── Panel content (appears above tab bar) ────────────────── */}
      {activeTab && (
        <div className="relative z-10 pointer-events-auto overflow-y-auto rounded-t-2xl bg-card shadow-[0_-4px_24px_rgba(0,0,0,0.18)] border-t border-border"
          style={{ maxHeight: "55dvh" }}>

          {/* Drag handle with chevron-down close indicator */}
          <div className="flex justify-center items-center pt-2.5 pb-1 sticky top-0 bg-card z-10">
            <div className="h-1 w-10 rounded-full bg-border" />
            <button
              onClick={() => { setActiveTab(null); setDrawerActiveTab(null); }}
              className="ml-auto mr-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              title="Close panel"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* ─ Courses panel ─────────────────────────────────────── */}
          {activeTab === "courses" && (
            <div className="pb-4">
              <div className="flex items-center justify-between px-4 pb-2">
                <div className="flex items-center gap-2">
                  <Route className="h-5 w-5 text-ocean" />
                  <span className="text-base font-bold text-foreground">Race Courses</span>
                  {marks.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">{marks.length} marks loaded</span>
                  )}
                </div>
              </div>

              <div className="border-t border-border px-4 py-2.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={showCourseOverlay} onChange={toggleCourseOverlay}
                    className="rounded accent-ocean" />
                  Show course marks on map
                </label>
              </div>

              {coursesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="px-4 pt-1">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Select Course</p>
                  <div className="space-y-1">
                    {courses.map((course) => {
                      const sel = selectedCourse?.id === course.id;
                      return (
                        <button key={course.id} onClick={() =>
                          setSelectedCourse(sel ? null : course)}
                          className={cn("w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                            sel ? "bg-ocean/15 ring-1 ring-ocean/40" : "hover:bg-muted/60")}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{course.name}</span>
                            {course.distance_nm && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Ruler className="h-3 w-3" />{course.distance_nm} nm
                              </span>
                            )}
                          </div>
                          {course.description && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{course.description}</p>
                          )}
                          <span className="mt-0.5 inline-block rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                            {course.course_type}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedCourse && courseLegs.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Course Legs
                      </p>
                      <div className="space-y-1 mb-3">
                        {courseLegs.map((leg, i) => (
                          <div key={`${leg.mark.id}-${leg.leg_order}`} className="flex items-center gap-2 text-xs">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ocean/20 text-[10px] font-bold text-ocean">
                              {leg.leg_order}
                            </div>
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="font-medium">{leg.mark.short_name}</span>
                            <span className="text-muted-foreground">({leg.rounding})</span>
                            {i < courseLegs.length - 1 && (
                              <Compass className="ml-auto h-3 w-3 text-muted-foreground/50" />
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setShowTacticalAnalysis(!showTacticalAnalysis)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean px-3 py-2.5 text-sm font-semibold text-white hover:bg-ocean/90"
                      >
                        {showTacticalAnalysis ? <><X className="h-4 w-4" /> Hide Analysis</> : <><Sparkles className="h-4 w-4" /> AI Tactical Analysis</>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─ GPS Track panel (always mounted while recording) ───── */}
          <div className={cn("pb-4", activeTab !== "gps" && "hidden")}>
            <div className="flex items-center justify-between px-4 pb-3">
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                ) : (
                  <Navigation className="h-5 w-5 text-ocean" />
                )}
                <span className="text-base font-bold text-foreground">
                  {isRecording ? fmtDur(gpsElapsed) : gpsSaved ? "Track saved" : "GPS Track"}
                </span>
                {isRecording && gpsSpeed != null && (
                  <span className="text-sm font-bold text-ocean">{gpsSpeed} kts</span>
                )}
              </div>
            </div>

            {(isRecording || gpsStats) && (
              <div className="grid grid-cols-4 gap-2 px-4 pb-3">
                {[
                  { icon: <Timer className="h-3 w-3" />, label: "Time",  value: fmtDur(gpsElapsed) },
                  { icon: <Gauge className="h-3 w-3" />,  label: "Speed", value: gpsSpeed != null ? `${gpsSpeed} kts` : "—" },
                  { icon: <Route className="h-3 w-3" />,  label: "Dist",  value: gpsStats ? `${gpsStats.distanceNm} nm` : "—" },
                  { icon: <Gauge className="h-3 w-3" />,  label: "Max",   value: gpsStats && gpsStats.maxSpeed > 0 ? `${gpsStats.maxSpeed} kts` : "—" },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center rounded-xl bg-muted/50 py-2">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      {s.icon}<span className="text-[9px]">{s.label}</span>
                    </div>
                    <span className="mt-0.5 text-xs font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            )}

            {gpsPoints.length > 0 && (
              <p className="px-4 pb-2 text-center text-[10px] text-muted-foreground">
                {gpsPoints.length} GPS point{gpsPoints.length !== 1 ? "s" : ""} recorded
              </p>
            )}

            {gpsError && (
              <p className="mx-4 mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">{gpsError}</p>
            )}

            <div className="flex gap-2 px-4">
              {!isRecording ? (
                <button onClick={startRecording}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ocean py-3 text-sm font-semibold text-white hover:bg-ocean/90">
                  <Play className="h-4 w-4 fill-white" />
                  {gpsPoints.length > 0 ? "New Track" : "Start GPS"}
                </button>
              ) : (
                <button onClick={stopRecording}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600">
                  <Square className="h-4 w-4 fill-white" />
                  Stop Recording
                </button>
              )}
              {!isRecording && gpsPoints.length >= 2 && !gpsSaved && (
                <button onClick={handleGpsSave} disabled={gpsSaving}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted px-4 py-3 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {gpsSaving ? "…" : "Save"}
                </button>
              )}
              {gpsSaved && (
                <span className="flex items-center rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400">
                  Saved
                </span>
              )}
            </div>
          </div>

          {/* ─ Race Timer panel (always mounted while running) ───── */}
          <div className={cn("pb-4", activeTab !== "timer" && "hidden")}>
            <div className="flex items-center gap-2 px-4 pb-3">
              <Flag className="h-5 w-5 text-ocean" />
              <span className="text-base font-bold text-foreground">Race Timer</span>
              {timerIsActive && (
                <span className={cn("ml-auto text-sm font-bold tabular-nums", timerPhaseColor)}>{timerPhase}</span>
              )}
            </div>

            {timerIsActive ? (
              <div className="px-4 space-y-3">
                <div className="text-center">
                  <p className={cn("font-mono text-5xl font-bold tabular-nums leading-none", timerPhaseColor)}>
                    {timerPhase === "RACING" ? "+" : ""}{fmtTime(remainingMs)}
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-ocean transition-all duration-100"
                    style={{ width: `${Math.min(100, timerPhase === "WARNING" ? ((300000 - remainingMs) / 60000) * 100 / 1 : timerPhase === "PREP" ? ((240000 - remainingMs) / 180000) * 100 : timerPhase === "ONE MIN" ? ((60000 - remainingMs) / 60000) * 100 : timerPhase === "RACING" ? Math.min((Math.abs(remainingMs) / 300000) * 100, 100) : 0)}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setTimerPlaying((p) => !p)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ocean text-white hover:bg-ocean/90">
                    {timerPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
                  </button>
                  <button onClick={handleTimerReset}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground hover:bg-muted/80">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <div className="flex flex-1 flex-col justify-center rounded-xl bg-muted/50 px-3 text-xs text-muted-foreground">
                    Tap Pause to freeze. Reset = new start.
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 space-y-3">
                <p className="text-sm text-muted-foreground text-center">5-minute race start sequence</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleStart5Min}
                    className="flex items-center justify-center gap-2 rounded-xl bg-ocean py-3 text-sm font-bold text-white hover:bg-ocean/90">
                    <Flag className="h-4 w-4" /> 5 MIN
                  </button>
                  <button onClick={handleTimerSync}
                    className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700">
                    <Play className="h-4 w-4 fill-white" /> SYNC
                  </button>
                </div>
                <p className="text-[10px] text-center text-muted-foreground">
                  5 MIN = start your own countdown from T-5:00.{" "}
                  SYNC = gun just fired, start racing timer.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Tab bar (always interactive) ───────────────────────────── */}
      <div className="relative z-10 pointer-events-auto grid grid-cols-3 border-t border-border bg-card backdrop-blur-md">

        {/* Courses tab */}
        <button onClick={() => toggle("courses")}
          className={cn(
            "flex flex-col items-center gap-0.5 py-3 min-h-[52px] text-xs font-medium transition-colors",
            activeTab === "courses" ? "text-ocean" : "text-muted-foreground hover:text-foreground"
          )}>
          <Route className="h-5 w-5" />
          <span>
            {selectedCourse ? (selectedCourse.short_name || "Course") : "Courses"}
          </span>
          {selectedCourse && (
            <div className="h-1 w-1 rounded-full bg-ocean" />
          )}
        </button>

        {/* GPS tab */}
        <button onClick={() => toggle("gps")}
          className={cn(
            "flex flex-col items-center gap-0.5 py-3 min-h-[52px] text-xs font-medium transition-colors",
            activeTab === "gps" ? "text-ocean" : "text-muted-foreground hover:text-foreground"
          )}>
          <div className="relative">
            <Navigation className="h-5 w-5" />
            {isRecording && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
            )}
          </div>
          <span>{isRecording ? fmtDur(gpsElapsed) : "GPS Track"}</span>
        </button>

        {/* Timer tab */}
        <button onClick={() => toggle("timer")}
          className={cn(
            "flex flex-col items-center gap-0.5 py-3 min-h-[52px] text-xs font-medium transition-colors",
            activeTab === "timer" ? "text-ocean" :
              timerIsActive ? timerPhaseColor : "text-muted-foreground hover:text-foreground"
          )}>
          <Flag className="h-5 w-5" />
          <span className="tabular-nums">{timerLabel}</span>
          {timerIsActive && activeTab !== "timer" && (
            <div className={cn("h-1 w-1 rounded-full", timerPhaseColor.replace("text-", "bg-"))} />
          )}
        </button>

      </div>
    </div>
  );
}
