"use client";

import { useState, useEffect, useCallback } from "react";
import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { BUOY_STATIONS } from "@/lib/constants";
import { TrendingUp, RefreshCw, ChevronDown } from "lucide-react";
import type { WindHistoryPoint } from "@/app/api/wind-history/[stationId]/route";

// ─── Mini SVG line chart ─────────────────────────────────────────

function WindChart({ points }: { points: WindHistoryPoint[] }) {
  if (points.length < 2) return null;

  const W = 300;
  const H = 72;
  const PAD = { top: 8, bottom: 18, left: 28, right: 8 };

  const dirs = points.map((p) => p.wind_dir);
  const minDir = Math.min(...dirs);
  const maxDir = Math.max(...dirs);
  const range = Math.max(maxDir - minDir, 10);

  const xScale = (i: number) =>
    PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const yScale = (d: number) =>
    PAD.top + (1 - (d - minDir) / range) * (H - PAD.top - PAD.bottom);

  const polyline = points
    .map((p, i) => `${xScale(i).toFixed(1)},${yScale(p.wind_dir).toFixed(1)}`)
    .join(" ");

  const mid = (minDir + maxDir) / 2;
  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
  };

  const recent = points.slice(-3).map((p) => p.wind_dir);
  const older = points.slice(0, 3).map((p) => p.wind_dir);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const shift = recentAvg - olderAvg;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <line
          x1={PAD.left} y1={yScale(mid)} x2={W - PAD.right} y2={yScale(mid)}
          stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3,2"
        />
        <text x={PAD.left - 4} y={yScale(maxDir) + 4} fontSize="9" textAnchor="end" className="fill-muted-foreground">
          {Math.round(maxDir)}°
        </text>
        <text x={PAD.left - 4} y={yScale(minDir) + 4} fontSize="9" textAnchor="end" className="fill-muted-foreground">
          {Math.round(minDir)}°
        </text>
        <polyline points={polyline} fill="none" stroke="#0ea5e9" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(p.wind_dir)} r="2" fill="#0ea5e9" />
        ))}
        <text x={xScale(0)} y={H - 2} fontSize="9" textAnchor="middle" className="fill-muted-foreground">
          {fmt(points[0].timestamp)}
        </text>
        <text x={xScale(points.length - 1)} y={H - 2} fontSize="9" textAnchor="middle" className="fill-muted-foreground">
          {fmt(points[points.length - 1].timestamp)}
        </text>
      </svg>

      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-xs font-medium ${Math.abs(shift) < 2 ? "text-green-600 dark:text-green-400" : shift > 0 ? "text-amber-500" : "text-blue-500"}`}>
          {Math.abs(shift) < 2
            ? "Steady wind direction"
            : shift > 0
            ? `Veering +${Math.abs(shift).toFixed(1)}° (clockwise)`
            : `Backing ${Math.abs(shift).toFixed(1)}° (counter-clockwise)`}
        </span>
        <span className="text-xs text-muted-foreground">
          {points[points.length - 1].wind_speed.toFixed(1)} kts
        </span>
      </div>
    </div>
  );
}

// ─── Bottom Sheet ─────────────────────────────────────────────────

export function WindShiftPanel() {
  const { showWindShift, toggleWindShift } = useMapStore();
  const { observations } = useWeatherStore();

  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [points, setPoints] = useState<WindHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  useEffect(() => {
    if (selectedStationId) return;
    for (const station of BUOY_STATIONS) {
      if (observations[station.id]?.wind_speed_kts != null) {
        setSelectedStationId(station.id);
        return;
      }
    }
    const first = BUOY_STATIONS.find((s) => !/^\d/.test(s.id));
    if (first) setSelectedStationId(first.id);
  }, [observations, selectedStationId]);

  const fetchHistory = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wind-history/${id}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setPoints(data.points ?? []);
      setLastFetched(Date.now());
    } catch {
      setError("Could not load wind history");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showWindShift && selectedStationId) {
      fetchHistory(selectedStationId);
    }
  }, [showWindShift, selectedStationId, fetchHistory]);

  if (!showWindShift) return null;

  const stationsWithData = BUOY_STATIONS.filter(
    (s) => observations[s.id]?.wind_speed_kts != null
  );

  return (
    /* Bottom sheet overlay */
    <div className="absolute bottom-0 left-0 right-0 z-30">
      {/* Backdrop tap to dismiss */}
      <div className="absolute inset-0 -top-[100dvh]" onClick={toggleWindShift} />

      <div className="relative rounded-t-2xl bg-card shadow-[0_-4px_32px_rgba(0,0,0,0.18)] backdrop-blur-md">
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-ocean" />
            <span className="text-base font-bold text-foreground">Wind Shifts</span>
            {lastFetched && (
              <span className="text-[10px] text-muted-foreground">
                · {new Date(lastFetched).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchHistory(selectedStationId)}
              disabled={loading}
              className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={toggleWindShift} className="rounded-lg p-1.5 hover:bg-muted">
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Station selector */}
        <div className="border-t border-border px-4 py-3">
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ocean"
          >
            {(stationsWithData.length > 0
              ? stationsWithData
              : BUOY_STATIONS.filter((s) => !/^\d/.test(s.id))
            ).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>
        </div>

        {/* Chart */}
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex h-20 items-center justify-center">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{error}</p>
          ) : points.length >= 2 ? (
            <WindChart points={points} />
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No history data for this station
            </p>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground text-center">
            Last 90 min · Veering = clockwise · NDBC data
          </p>
        </div>
      </div>
    </div>
  );
}
