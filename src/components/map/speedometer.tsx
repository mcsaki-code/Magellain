"use client";

import { useEffect, useState, useCallback } from "react";
import { Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

type SpeedUnit = "kts" | "mph" | "kmh";
const CONVERSIONS: Record<SpeedUnit, number> = { kts: 1.94384, mph: 2.23694, kmh: 3.6 };
const UNIT_LABELS: Record<SpeedUnit, string> = { kts: "kts", mph: "mph", kmh: "km/h" };

export function Speedometer() {
  const [speed, setSpeed] = useState<number | null>(null);    // m/s
  const [heading, setHeading] = useState<number | null>(null);
  const [unit, setUnit] = useState<SpeedUnit>("kts");
  const [error, setError] = useState(false);

  // Load saved unit preference
  useEffect(() => {
    const saved = localStorage.getItem("magellain-speed-unit") as SpeedUnit | null;
    if (saved && saved in CONVERSIONS) setUnit(saved);
  }, []);

  // Auto-start GPS on mount — no button needed
  useEffect(() => {
    if (!navigator.geolocation) { setError(true); return; }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setSpeed(pos.coords.speed);
        setHeading(pos.coords.heading);
        setError(false);
      },
      () => setError(true),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const cycleUnit = () => {
    const units: SpeedUnit[] = ["kts", "mph", "kmh"];
    const next = units[(units.indexOf(unit) + 1) % units.length];
    setUnit(next);
    localStorage.setItem("magellain-speed-unit", next);
  };

  // Don't render if GPS error or permission denied
  if (error) return null;

  const converted = speed !== null && speed >= 0
    ? (speed * CONVERSIONS[unit]).toFixed(1)
    : "—";

  return (
    <button
      onClick={cycleUnit}
      title="Tap to change speed units"
      className={cn(
        "absolute top-3 left-1/2 -translate-x-1/2 z-10",
        "flex items-center gap-1.5 rounded-full px-3 py-1.5",
        "bg-card/90 backdrop-blur-sm shadow-md border border-border/40",
        "text-sm font-semibold tabular-nums text-foreground",
        "transition-all active:scale-95"
      )}
    >
      {heading !== null && (
        <Navigation
          className="h-3.5 w-3.5 text-ocean shrink-0"
          style={{ transform: `rotate(${heading}deg)` }}
        />
      )}
      <span>{converted}</span>
      <span className="text-[10px] font-normal text-muted-foreground">{UNIT_LABELS[unit]}</span>
    </button>
  );
}
