"use client";

import { useState, useEffect, useCallback } from "react";
import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { BUOY_STATIONS } from "@/lib/constants";
import { TrendingUp, X, RefreshCw } from "lucide-react";
import type { WindHistoryPoint } from "@/app/api/wind-history/[stationId]/route";

// ─── Mini SVG line chart ─────────────────────────────────────────

function WindChart({ points }: { points: WindHistoryPoint[] }) {
  if (points.length < 2) return null;

  const W = 260;
  const H = 80;
  const PAD = { top: 8, bottom: 20, left: 28, right: 8 };

  const dirs = points.map((p) => p.wind_dir);
  const minDir = Math.min(...dirs);
  const maxDir = Math.max(...dirs);
  const range = Math.max(maxDir - minDir, 10); // at least 10° range

  const xScale = (i: number) =>
    PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const yScale = (d: number) =>
    PAD.top + (1 - (d - minDir) / range) * (H - PAD.top - PAD.bottom);

  // Build polyline points
  const polyline = points
    .map((p, i) => `${xScale(i).toFixed(1)},${yScale(p.wind_dir).toFixed(1)}`)
    .join(" ");

  // Y-axis labels (min, mid, max)
  const mid = (minDir + maxDir) / 2;

  // X-axis: first and last time labels
  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
  };

  // Compute trend arrow
  const recent = points.slice(-3).map((p) => p.wind_dir);
  const older = points.slice(0, 3).map((p) => p.wind_dir);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const shift = recentAvg - olderAvg;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
      >
        {/* Grid line at mid */}
        <line
          x1={PAD.left}
          y1={yScale(mid)}
          x2={W - PAD.right}
          y2={yScale(mid)}
          stroke="hsl(var(--border))"
          strokeWidth="0.5"
          strokeDasharray="3,2"
        />

        {/* Y-axis labels */}
        <text x={PAD.left - 4} y={yScale(maxDir) + 4} fontSize="9" fill="currentColor" textAnchor="end" className="fill-muted-foreground">
          {Math.round(maxDir)}°
        </text>
        <text x={PAD.left - 4} y={yScale(minDir) + 4} fontSize="9" fill="currentColor" textAnchor="end" className="fill-muted-foreground">
          {Math.round(minDir)}°
        </text>

        {/* Wind direction line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots at each point */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(p.wind_dir)}
            r="2.5"
            fill="#0ea5e9"
          />
        ))}

        {/* X-axis time labels */}
        <text
          x={xScale(0)}
          y={H - 4}
          fontSize="9"
          textAnchor="middle"
          className="fill-muted-foreground"
        >
          {fmt(points[0].timestamp)}
        </text>
        <text
          x={xScale(points.length - 1)}
          y={H - 4}
          fontSize="9"
          textAnchor="middle"
          className="fill-muted-foreground"
        >
          {fmt(points[points.length - 1].timestamp)}
        </text>
      </svg>

      {/* Trend summary */}
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {Math.abs(shift) < 2
            ? "Steady"
            : shift > 0
            ? `Veering +${Math.abs(shift).toFixed(1)}° (clkw)`
            : `Backing ${Math.abs(shift).toFixed(1)}° (cclkw)`}
        </span>
        <span>
          {points[points.length - 1].wind_speed.toFixed(1)} kts now
        </span>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────

export function WindShiftPanel() {
  const { showWindShift } = useMapStore();
  const { observations } = useWeatherStore();

  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [points, setPoints] = useState<WindHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  // Pick default station: first one with live observations
  useEffect(() => {
    if (selectedStationId) return;
    for (const station of BUOY_STATIONS) {
      if (observations[station.id]?.wind_speed_kts != null) {
        setSelectedStationId(station.id);
        return;
      }
    }
    // Fallback to first shore station
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
    } catch (e) {
      setError("Could not load wind history");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when station changes or panel opens
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
    <div className="absolute left-2 top-14 z-20 w-72 rounded-lg bg-card/95 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-ocean" />
          <span className="text-sm font-bold text-foreground">Wind Shifts</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchHistory(selectedStationId)}
            disabled={loading}
            className="rounded p-1 hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Station selector */}
      <div className="border-b border-border px-3 py-2">
        <select
          value={selectedStationId}
          onChange={(e) => setSelectedStationId(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ocean"
        >
          {stationsWithData.length > 0
            ? stationsWithData.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))
            : BUOY_STATIONS.filter((s) => !/^\d/.test(s.id)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
        </select>
        {lastFetched && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Updated {new Date(lastFetched).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Chart area */}
      <div className="p-3">
        {loading ? (
          <div className="flex h-20 items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{error}</p>
        ) : points.length >= 2 ? (
          <WindChart points={points} />
        ) : (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No history available for this station
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-2 text-[9px] text-muted-foreground">
        Last 90 min of wind direction. Veering = clockwise shift. NDBC data.
      </div>
    </div>
  );
}
