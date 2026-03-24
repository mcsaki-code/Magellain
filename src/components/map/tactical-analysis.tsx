"use client";

import { useState, useEffect } from "react";
import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { Sparkles, Wind, Compass, ArrowRight, Loader2, X } from "lucide-react";

interface CourseLeg {
  leg_order: number;
  rounding: string;
  notes: string | null;
  mark: {
    id: string;
    name: string;
    short_name: string;
    latitude: number;
    longitude: number;
  };
}

// ─── Bearing & distance calculations ─────────────────────────────

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function calculateDistanceNm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3440.065; // Earth radius in nm
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getPointOfSail(trueWindAngle: number): string {
  const a = Math.abs(trueWindAngle);
  if (a < 30) return "In Irons (No-Go Zone)";
  if (a < 50) return "Close Hauled";
  if (a < 70) return "Close Reach";
  if (a < 110) return "Beam Reach";
  if (a < 140) return "Broad Reach";
  if (a < 165) return "Deep Broad Reach";
  return "Running";
}

function getWindAngleToLeg(windDir: number, legBearing: number): number {
  // True wind angle relative to the leg bearing
  let angle = windDir - legBearing;
  if (angle > 180) angle -= 360;
  if (angle < -180) angle += 360;
  return angle;
}

function compassDirection(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── Tactical advice per point of sail ───────────────────────────

function getTacticalAdvice(pointOfSail: string, windSpeed: number, rounding: string): string {
  const heavy = windSpeed > 15;
  const light = windSpeed < 8;

  switch (pointOfSail) {
    case "Close Hauled":
      if (heavy) return `Hike hard, depower with traveler/backstay. Favor the ${rounding === "port" ? "right" : "left"} side to minimize distance. Consider two tacks vs. pinching.`;
      if (light) return `Keep the boat flat and moving. Foot slightly for VMG. Watch for wind shifts to tack on headers.`;
      return `Sail close to the wind but don't pinch. Tack on headers, hold on lifts. Favor the side with more pressure.`;

    case "Close Reach":
      if (heavy) return "Ease the main slightly, keep crew weight aft. Good mode for VMG — resist the urge to bear off.";
      return "Fast and manageable point of sail. Keep sails trimmed tight, aim slightly above the mark to account for leeway.";

    case "Beam Reach":
      return "Fastest point of sail for most boats. Ease sails to ~45 degrees, crew hikes to keep boat flat. Watch for gusts.";

    case "Broad Reach":
      if (heavy) return "Risk of accidental gybe in gusts — keep crew alert. Consider flying the spinnaker if class allows.";
      return "Fly the spinnaker if available. Keep apparent wind forward by sailing deeper in puffs, higher in lulls.";

    case "Deep Broad Reach":
    case "Running":
      if (heavy) return "Danger of death roll in heavy air. Consider gybing downwind (VMG running) instead of sailing dead downwind.";
      if (light) return "Sail higher angles and gybe downwind for better VMG. Head up in lulls, bear away in puffs.";
      return "Consider VMG running — sail 10-15 degrees above dead downwind and gybe. Watch for wind shifts.";

    case "In Irons (No-Go Zone)":
      return "Cannot sail directly into the wind. You'll need to tack upwind — plan your laylines carefully.";

    default:
      return "Maintain course awareness and trim sails for the angle.";
  }
}

// ─── Component ──────────────────────────────────────────────────

export function TacticalAnalysis() {
  const { selectedCourse, courseLegs, showTacticalAnalysis, setShowTacticalAnalysis } = useMapStore();
  const { observations } = useWeatherStore();
  const [windDir, setWindDir] = useState<number | null>(null);
  const [windSpeed, setWindSpeed] = useState<number | null>(null);

  // Get latest wind data from any station
  useEffect(() => {
    const stationIds = Object.keys(observations);
    if (stationIds.length === 0) return;

    // Use the first station with wind data
    for (const id of stationIds) {
      const obs = observations[id];
      if (obs?.wind_direction_deg != null && obs?.wind_speed_kts != null) {
        setWindDir(obs.wind_direction_deg);
        setWindSpeed(obs.wind_speed_kts);
        break;
      }
    }
  }, [observations]);

  if (!showTacticalAnalysis || !selectedCourse || courseLegs.length < 2) {
    return null;
  }

  // Build leg analysis
  const legAnalysis = [];
  for (let i = 0; i < courseLegs.length - 1; i++) {
    const from = courseLegs[i];
    const to = courseLegs[i + 1];

    const bearing = calculateBearing(
      from.mark.latitude,
      from.mark.longitude,
      to.mark.latitude,
      to.mark.longitude
    );
    const distance = calculateDistanceNm(
      from.mark.latitude,
      from.mark.longitude,
      to.mark.latitude,
      to.mark.longitude
    );

    let pointOfSail = "Unknown";
    let windAngle = 0;
    let advice = "No wind data available — check weather stations.";

    if (windDir != null && windSpeed != null) {
      windAngle = getWindAngleToLeg(windDir, bearing);
      pointOfSail = getPointOfSail(windAngle);
      advice = getTacticalAdvice(pointOfSail, windSpeed, to.rounding);
    }

    legAnalysis.push({
      from: from.mark,
      to: to.mark,
      bearing: Math.round(bearing),
      distance: distance.toFixed(2),
      pointOfSail,
      windAngle: Math.round(windAngle),
      advice,
      rounding: to.rounding,
    });
  }

  const windConditions =
    windDir != null && windSpeed != null
      ? `${Math.round(windSpeed)} kts from ${compassDirection(windDir)} (${Math.round(windDir)}°)`
      : "No wind data";

  return (
    <div className="absolute left-2 bottom-14 z-20 w-80 max-h-[60vh] overflow-y-auto rounded-lg bg-card/95 shadow-xl backdrop-blur-sm">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ocean" />
          <span className="text-sm font-bold text-foreground">
            Tactical Analysis
          </span>
        </div>
        <button
          onClick={() => setShowTacticalAnalysis(false)}
          className="rounded p-1 hover:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Wind conditions */}
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Wind className="h-3.5 w-3.5 text-ocean" />
          <span className="font-medium">Current Wind:</span>
          <span className="text-muted-foreground">{windConditions}</span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {selectedCourse.name}
          {selectedCourse.distance_nm
            ? ` — ~${selectedCourse.distance_nm} nm`
            : ""}
        </p>
      </div>

      {/* Leg-by-leg analysis */}
      <div className="p-2">
        {legAnalysis.map((leg, i) => (
          <div
            key={i}
            className="mb-2 rounded-md border border-border bg-background/50 p-2"
          >
            {/* Leg header */}
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ocean text-[10px] text-white">
                {i + 1}
              </span>
              <span>{leg.from.short_name}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span>{leg.to.short_name}</span>
              <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                {leg.rounding === "pass" ? "pass through" : `rnd ${leg.rounding}`}
              </span>
            </div>

            {/* Leg stats */}
            <div className="mb-1.5 flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Compass className="h-3 w-3" />
                {leg.bearing}° ({compassDirection(leg.bearing)})
              </span>
              <span>{leg.distance} nm</span>
            </div>

            {/* Point of sail */}
            <div className="mb-1 rounded bg-ocean/10 px-2 py-1 text-[11px] font-semibold text-ocean">
              {leg.pointOfSail}
              {windDir != null && (
                <span className="ml-1 font-normal text-ocean/70">
                  (TWA {leg.windAngle > 0 ? "+" : ""}
                  {leg.windAngle}°)
                </span>
              )}
            </div>

            {/* Tactical advice */}
            <p className="text-[11px] leading-relaxed text-foreground/80">
              {leg.advice}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-2 text-[9px] text-muted-foreground">
        Analysis based on current wind conditions. Always verify with on-water
        observations. Conditions can change rapidly on Lake Erie.
      </div>
    </div>
  );
}
