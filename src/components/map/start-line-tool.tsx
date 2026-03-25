"use client";

import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { Flag, Crosshair, ChevronDown, Trash2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Bearing / bias helpers ───────────────────────────────────────

function calculateBearing(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(toLng - fromLng);
  const y = Math.sin(dLng) * Math.cos(toRad(toLat));
  const x =
    Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) -
    Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function normalizeTo180(angle: number): number {
  let a = ((angle % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

function calculateBias(
  boatEnd: [number, number],
  committeeEnd: [number, number],
  windFrom: number
): number {
  const lineBearing = calculateBearing(
    boatEnd[0], boatEnd[1], committeeEnd[0], committeeEnd[1]
  );
  const idealBearing = (windFrom + 90) % 360;
  let bias = normalizeTo180(lineBearing - idealBearing);
  if (bias > 90) bias -= 180;
  if (bias < -90) bias += 180;
  return bias;
}

function calculateDistanceMeters(p1: [number, number], p2: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(p2[1] - p1[1]);
  const dLng = toRad(p2[0] - p1[0]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1[1])) * Math.cos(toRad(p2[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Component ────────────────────────────────────────────────────

export function StartLineTool() {
  const {
    showStartLineTool,
    setShowStartLineTool,
    startLine,
    startLinePlacing,
    setStartLinePlacing,
    clearStartLine,
  } = useMapStore();
  const { observations } = useWeatherStore();

  if (!showStartLineTool) return null;

  let windFrom: number | null = null;
  for (const obs of Object.values(observations)) {
    if (obs?.wind_direction_deg != null) {
      windFrom = obs.wind_direction_deg;
      break;
    }
  }

  const { boatEnd, committeeEnd } = startLine;
  const bothSet = boatEnd !== null && committeeEnd !== null;

  let bias: number | null = null;
  let favoredEnd = "";
  let biasColor = "text-muted-foreground";
  let lineLength: number | null = null;

  if (bothSet && windFrom !== null) {
    bias = calculateBias(boatEnd!, committeeEnd!, windFrom);
    const absBias = Math.abs(bias);
    if (absBias < 2) {
      favoredEnd = "Square line";
      biasColor = "text-green-600 dark:text-green-400";
    } else if (bias > 0) {
      favoredEnd = `Port (boat) end +${absBias.toFixed(1)}°`;
      biasColor = absBias > 10 ? "text-red-500" : "text-amber-500";
    } else {
      favoredEnd = `Starboard (committee) end +${absBias.toFixed(1)}°`;
      biasColor = absBias > 10 ? "text-red-500" : "text-amber-500";
    }
  }

  if (bothSet) {
    lineLength = calculateDistanceMeters(boatEnd!, committeeEnd!);
  }

  const handleClose = () => {
    setShowStartLineTool(false);
    clearStartLine();
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30">
      {/* Backdrop tap to dismiss */}
      <div className="absolute inset-0 -top-[100dvh]" onClick={handleClose} />

      <div className="relative rounded-t-2xl bg-card shadow-[0_-4px_32px_rgba(0,0,0,0.18)] backdrop-blur-md">
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-ocean" />
            <span className="text-base font-bold text-foreground">Start Line Bias</span>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-muted">
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Wind info bar */}
        <div className="border-t border-border px-4 py-2.5">
          {windFrom !== null ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Wind from</span>
              <span className="text-sm font-bold text-foreground">{Math.round(windFrom)}°</span>
              <span className="text-sm text-muted-foreground">· Ideal line</span>
              <span className="text-sm font-bold text-ocean">{Math.round((windFrom + 90) % 360)}°</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No wind data — tap Refresh weather first</p>
          )}
        </div>

        {/* Mark placement buttons */}
        <div className="grid grid-cols-2 gap-3 px-4 py-3">
          {/* Boat end */}
          <button
            onClick={() => setStartLinePlacing(startLinePlacing === "boat" ? null : "boat")}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-all",
              startLinePlacing === "boat"
                ? "border-ocean bg-ocean/10 text-ocean"
                : boatEnd
                ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                : "border-border bg-muted/30 text-foreground hover:bg-muted"
            )}
          >
            {startLinePlacing === "boat" ? (
              <Crosshair className="h-4 w-4 animate-pulse shrink-0" />
            ) : (
              <div className={cn("h-3.5 w-3.5 shrink-0 rounded-full border-2",
                boatEnd ? "border-green-500 bg-green-500" : "border-muted-foreground"
              )} />
            )}
            <div className="text-left leading-tight">
              <div className="text-xs font-semibold">Boat / Pin</div>
              <div className="text-[10px] opacity-70">
                {startLinePlacing === "boat" ? "Tap map" : boatEnd ? `${boatEnd[1].toFixed(3)}°N` : "Not set"}
              </div>
            </div>
          </button>

          {/* Committee end */}
          <button
            onClick={() => setStartLinePlacing(startLinePlacing === "committee" ? null : "committee")}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-all",
              startLinePlacing === "committee"
                ? "border-ocean bg-ocean/10 text-ocean"
                : committeeEnd
                ? "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                : "border-border bg-muted/30 text-foreground hover:bg-muted"
            )}
          >
            {startLinePlacing === "committee" ? (
              <Crosshair className="h-4 w-4 animate-pulse shrink-0" />
            ) : (
              <div className={cn("h-3.5 w-3.5 shrink-0 rounded border-2",
                committeeEnd ? "border-blue-500 bg-blue-500" : "border-muted-foreground"
              )} />
            )}
            <div className="text-left leading-tight">
              <div className="text-xs font-semibold">Committee</div>
              <div className="text-[10px] opacity-70">
                {startLinePlacing === "committee" ? "Tap map" : committeeEnd ? `${committeeEnd[1].toFixed(3)}°N` : "Not set"}
              </div>
            </div>
          </button>
        </div>

        {/* Bias result */}
        {bothSet && windFrom !== null && (
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <TrendingUp className="h-3.5 w-3.5 text-ocean" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bias</span>
                </div>
                <p className={cn("text-base font-bold leading-tight", biasColor)}>
                  {favoredEnd}
                </p>
                {bias !== null && Math.abs(bias) >= 2 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {Math.abs(bias) > 15 ? "Strong — start at favored end early"
                      : Math.abs(bias) > 8 ? "Moderate — consider the favored end"
                      : "Slight — both ends sailable"}
                  </p>
                )}
              </div>
              {lineLength !== null && (
                <div className="text-right">
                  <p className="text-xs font-bold text-foreground">{Math.round(lineLength)}m</p>
                  <p className="text-[10px] text-muted-foreground">{(lineLength * 0.000539957).toFixed(2)} nm</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          {(boatEnd || committeeEnd) ? (
            <button
              onClick={clearStartLine}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear line
            </button>
          ) : (
            <span className="text-[10px] text-muted-foreground">Tap a button, then tap on the map</span>
          )}
        </div>
      </div>
    </div>
  );
}
