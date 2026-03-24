"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Square, Navigation, Timer, Gauge, Route, Save, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface TrackPoint {
  lat: number;
  lng: number;
  ts: number;       // epoch ms
  speed_kts: number | null;
  heading: number | null;
}

interface TrackStats {
  durationSec: number;
  distanceNm: number;
  maxSpeed: number;
  avgSpeed: number;
}

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065; // nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function GpsTracker() {
  const [isRecording, setIsRecording] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pointsRef = useRef<TrackPoint[]>([]);

  // Keep pointsRef in sync for use in callbacks
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const stopRecording = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsExpanded(true); // Expand to show save option
  }, []);

  const startRecording = useCallback(() => {
    setError(null);
    setSaved(false);
    setPoints([]);
    pointsRef.current = [];
    setElapsed(0);
    setCurrentSpeed(null);
    startTimeRef.current = Date.now();

    // Timer
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // GPS watch
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const speedMs = pos.coords.speed;
        const speedKts = speedMs != null ? speedMs * 1.944 : null;
        setCurrentSpeed(speedKts !== null ? Math.round(speedKts * 10) / 10 : null);

        const pt: TrackPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: pos.timestamp,
          speed_kts: speedKts !== null ? Math.round(speedKts * 10) / 10 : null,
          heading: pos.coords.heading,
        };
        setPoints((prev) => [...prev, pt]);
      },
      (err) => {
        stopRecording();
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access denied. Enable in browser settings.");
        } else {
          setError("GPS unavailable. Check device location settings.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    setIsRecording(true);
    setIsExpanded(true);
  }, [stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const computeStats = (pts: TrackPoint[]): TrackStats => {
    let distNm = 0;
    const speeds = pts.filter((p) => p.speed_kts != null).map((p) => p.speed_kts as number);
    for (let i = 1; i < pts.length; i++) {
      distNm += haversineNm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    }
    return {
      durationSec: pts.length > 0 ? Math.floor((pts[pts.length - 1].ts - pts[0].ts) / 1000) : elapsed,
      distanceNm: Math.round(distNm * 100) / 100,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
      avgSpeed: speeds.length > 0 ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10 : 0,
    };
  };

  const handleSave = async () => {
    if (points.length < 2) return;
    setSaving(true);
    const stats = computeStats(points);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Save to localStorage for anonymous users
        const track = { points, stats, savedAt: new Date().toISOString() };
        const existing = JSON.parse(localStorage.getItem("magellain-tracks") || "[]");
        existing.unshift(track);
        localStorage.setItem("magellain-tracks", JSON.stringify(existing.slice(0, 10)));
        setSaved(true);
      } else {
        // Get primary boat
        const { data: boat } = await supabase
          .from("boats")
          .select("id")
          .eq("owner_id", user.id)
          .eq("is_primary", true)
          .single();

        await supabase.from("gps_tracks").insert({
          user_id: user.id,
          boat_id: boat?.id || null,
          name: `Track ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
          started_at: new Date(points[0].ts).toISOString(),
          ended_at: new Date(points[points.length - 1].ts).toISOString(),
          duration_sec: stats.durationSec,
          distance_nm: stats.distanceNm,
          max_speed_kts: stats.maxSpeed,
          avg_speed_kts: stats.avgSpeed,
          track_points: points,
        });
        setSaved(true);
      }
    } catch {
      setError("Could not save track. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const stats = points.length > 1 ? computeStats(points) : null;

  return (
    <div className="absolute bottom-4 right-2 z-10 w-52">
      {/* Collapsed / header row */}
      <div
        className="flex items-center gap-2 rounded-xl bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm cursor-pointer"
        onClick={() => setIsExpanded((e) => !e)}
      >
        {isRecording ? (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        ) : (
          <Navigation className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 text-xs font-semibold text-foreground">
          {isRecording ? formatDuration(elapsed) : saved ? "Track saved" : "GPS Track"}
        </span>
        {isRecording && currentSpeed != null && (
          <span className="text-xs font-bold text-ocean">{currentSpeed} kts</span>
        )}
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="mt-1 rounded-xl bg-card/95 p-3 shadow-lg backdrop-blur-sm space-y-3">
          {/* Stats grid */}
          {(isRecording || stats) && (
            <div className="grid grid-cols-2 gap-2">
              <Stat icon={<Timer className="h-3 w-3" />} label="Time" value={formatDuration(elapsed)} />
              <Stat icon={<Gauge className="h-3 w-3" />} label="Speed" value={currentSpeed != null ? `${currentSpeed} kts` : "—"} />
              <Stat icon={<Route className="h-3 w-3" />} label="Dist." value={stats ? `${stats.distanceNm} nm` : "—"} />
              <Stat icon={<Gauge className="h-3 w-3" />} label="Max" value={stats && stats.maxSpeed > 0 ? `${stats.maxSpeed} kts` : "—"} />
            </div>
          )}

          {/* Points count */}
          {points.length > 0 && (
            <p className="text-center text-[10px] text-muted-foreground">
              {points.length} GPS point{points.length !== 1 ? "s" : ""} recorded
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-500/10 px-2 py-1.5 text-[10px] text-red-500">{error}</p>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            {!isRecording ? (
              <button
                onClick={(e) => { e.stopPropagation(); startRecording(); }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ocean py-2.5 text-xs font-semibold text-white transition-colors hover:bg-ocean-600"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                {points.length > 0 ? "New Track" : "Start"}
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); stopRecording(); }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-600"
              >
                <Square className="h-3.5 w-3.5 fill-white" />
                Stop
              </button>
            )}

            {!isRecording && points.length >= 2 && !saved && (
              <button
                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                disabled={saving}
                className="flex items-center justify-center gap-1 rounded-xl border border-border bg-muted px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "…" : "Save"}
              </button>
            )}
            {saved && (
              <span className="flex items-center justify-center rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-xs font-medium text-green-600 dark:text-green-400">
                Saved
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/50 py-1.5">
      <div className="flex items-center gap-1 text-muted-foreground">{icon}<span className="text-[9px]">{label}</span></div>
      <span className="mt-0.5 text-xs font-bold text-foreground">{value}</span>
    </div>
  );
}
