"use client";

import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { Flag, Crosshair, X, Trash2, TrendingUp } from "lucide-react";
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

/**
 * Calculate start line bias.
 *
 * Returns bias in degrees:
 *   positive → port/boat end is favored
 *   negative → starboard/committee end is favored
 *
 * Methodology:
 *   The ideal start line is perpendicular to the wind — bearing = windFrom + 90.
 *   We compare the actual line bearing (boat→committee) against that ideal.
 *   A line tipped clockwise from ideal means the boat/port end is lifted → favored.
 */
function calculateBias(
  boatEnd: [number, number],
  committeeEnd: [number, number],
  windFrom: number
): number {
  // Bearing of the line from boat (pin) end toward committee end
  const lineBearing = calculateBearing(
    boatEnd[0],
    boatEnd[1],
    committeeEnd[0],
    committeeEnd[1]
  );
  // Ideal line bearing: perpendicular to wind, looking right when facing into wind
  const idealBearing = (windFrom + 90) % 360;
  // Bias: how many degrees is actual rotated from ideal
  let bias = normalizeTo180(lineBearing - idealBearing);
  // Normalize to ±90 because a line is symmetric (180° == same line)
  if (bias > 90) bias -= 180;
  if (bias < -90) bias += 180;
  return bias;
}

function calculateDistanceMeters(
  p1: [number, number],
  p2: [number, number]
): number {
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

  // Get wind direction from first station with data
  let windFrom: number | null = null;
  for (const obs of Object.values(observations)) {
    if (obs?.wind_direction_deg != null) {
      windFrom = obs.wind_direction_deg;
      break;
    }
  }

  const { boatEnd, committeeEnd } = startLine;
  const bothSet = boatEnd !== null && committeeEnd !== null;

  // Bias calculation
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

  return (
    <div className="absolute right-2 bottom-14 z-20 w-72 rounded-lg bg-card/95 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-ocean" />
          <span className="text-sm font-bold text-foreground">Start Line Bias</span>
        </div>
        <button
          onClick={() => {
            setShowStartLineTool(false);
            clearStartLine();
          }}
          className="rounded p-1 hover:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Wind info */}
      <div className="border-b border-border px-3 py-2">
        {windFrom !== null ? (
          <p className="text-xs text-muted-foreground">
            Wind from{" "}
            <span className="font-semibold text-foreground">
              {Math.round(windFrom)}°
            </span>{" "}
            — ideal line bearing{" "}
            <span className="font-semibold text-ocean">
              {Math.round((windFrom + 90) % 360)}°
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No wind data — load weather first</p>
        )}
      </div>

      {/* Mark buttons */}
      <div className="space-y-2 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tap to place, then tap on the map
        </p>

        {/* Boat end button */}
        <button
          onClick={() =>
            setStartLinePlacing(startLinePlacing === "boat" ? null : "boat")
          }
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
            startLinePlacing === "boat"
              ? "border-ocean bg-ocean/10 text-ocean"
              : boatEnd
              ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-border bg-muted/30 text-foreground hover:bg-muted"
          )}
        >
          {startLinePlacing === "boat" ? (
            <Crosshair className="h-4 w-4 animate-pulse" />
          ) : (
            <div
              className={cn(
                "h-3 w-3 rounded-full border-2",
                boatEnd ? "border-green-500 bg-green-500" : "border-muted-foreground"
              )}
            />
          )}
          <span>Boat / Pin End</span>
          {boatEnd && !startLinePlacing && (
            <span className="ml-auto text-[10px] font-normal opacity-70">
              {boatEnd[1].toFixed(4)}°N
            </span>
          )}
          {startLinePlacing === "boat" && (
            <span className="ml-auto text-[10px]">Click map</span>
          )}
        </button>

        {/* Committee end button */}
        <button
          onClick={() =>
            setStartLinePlacing(startLinePlacing === "committee" ? null : "committee")
          }
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
            startLinePlacing === "committee"
              ? "border-ocean bg-ocean/10 text-ocean"
              : committeeEnd
              ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400"
              : "border-border bg-muted/30 text-foreground hover:bg-muted"
          )}
        >
          {startLinePlacing === "committee" ? (
            <Crosshair className="h-4 w-4 animate-pulse" />
          ) : (
            <div
              className={cn(
                "h-3 w-3 rounded-sm border-2",
                committeeEnd ? "border-blue-500 bg-blue-500" : "border-muted-foreground"
              )}
            />
          )}
          <span>Committee Boat End</span>
          {committeeEnd && !startLinePlacing && (
            <span className="ml-auto text-[10px] font-normal opacity-70">
              {committeeEnd[1].toFixed(4)}°N
            </span>
          )}
          {startLinePlacing === "committee" && (
            <span className="ml-auto text-[10px]">Click map</span>
          )}
        </button>
      </div>

      {/* Bias result */}
      {bothSet && (
        <div className="border-t border-border p-3">
          <div className="rounded-lg bg-background/60 p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-ocean" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bias</span>
            </div>
            {windFrom !== null ? (
              <>
                <p className={cn("text-lg font-bold leading-tight", biasColor)}>
                  {favoredEnd}
                </p>
                {bias !== null && Math.abs(bias) >= 2 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Line is {Math.abs(bias).toFixed(1)}° off perpendicular.{" "}
                    {Math.abs(bias) > 15
                      ? "Strong bias — start early at the favored end."
                      : Math.abs(bias) > 8
                      ? "Moderate bias — consider the favored end."
                      : "Slight bias — both ends sailable."}
                  </p>
                )}
                {lineLength !== null && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Line length: {Math.round(lineLength)}m /{" "}
                    {(lineLength * 0.000539957).toFixed(2)} nm
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Waiting for wind data...</p>
            )}
          </div>
        </div>
      )}

      {/* Clear button */}
      {(boatEnd || committeeEnd) && (
        <div className="border-t border-border px-3 py-2">
          <button
            onClick={clearStartLine}
            className="flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Line
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border px-3 py-2 text-[9px] text-muted-foreground">
        Place boat and committee ends on the map. Bias uses live wind from nearest NDBC station.
      </div>
    </div>
  );
}
