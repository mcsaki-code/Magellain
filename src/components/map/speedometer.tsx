"use client";

import { useEffect, useState, useCallback } from "react";
import { Navigation, Gauge } from "lucide-react";

type SpeedUnit = "kts" | "mph" | "kmh" | "nmh";

const UNIT_LABELS: Record<SpeedUnit, string> = {
  kts: "kts",
  mph: "mph",
  kmh: "km/h",
  nmh: "nm/h",
};

// m/s conversion factors
const CONVERSIONS: Record<SpeedUnit, number> = {
  kts: 1.94384,
  mph: 2.23694,
  kmh: 3.6,
  nmh: 1.94384, // same as knots
};

interface GpsData {
  speed: number | null; // m/s from GPS
  heading: number | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
}

export function Speedometer() {
  const [gps, setGps] = useState<GpsData>({ speed: null, heading: null, lat: null, lng: null, accuracy: null });
  const [unit, setUnit] = useState<SpeedUnit>("kts");
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [maxSpeed, setMaxSpeed] = useState(0);

  // Load preferred unit from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("magellain-speed-unit");
    if (saved && saved in CONVERSIONS) setUnit(saved as SpeedUnit);
  }, []);

  const convertSpeed = useCallback((ms: number | null): number => {
    if (ms === null || ms < 0) return 0;
    return Math.round(ms * CONVERSIONS[unit] * 10) / 10;
  }, [unit]);

  const startTracking = () => {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const newGps: GpsData = {
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGps(newGps);

        if (pos.coords.speed !== null) {
          const converted = pos.coords.speed * CONVERSIONS[unit];
          if (converted > maxSpeed) setMaxSpeed(Math.round(converted * 10) / 10);
        }
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    setWatchId(id);
    setIsTracking(true);
  };

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  };

  const cycleUnit = () => {
    const units: SpeedUnit[] = ["kts", "mph", "kmh", "nmh"];
    const next = units[(units.indexOf(unit) + 1) % units.length];
    setUnit(next);
    localStorage.setItem("magellain-speed-unit", next);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [watchId]);

  const currentSpeed = convertSpeed(gps.speed);

  return (
    <div className="absolute top-24 right-3 z-10 w-36 rounded-xl bg-card/95 p-3 shadow-xl backdrop-blur-sm">
      {!isTracking ? (
        <button
          onClick={startTracking}
          className="flex items-center justify-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <Gauge className="h-3 w-3" />
          Speed
        </button>
      ) : (
        <div className="text-center">
          {/* Speed display */}
          <button onClick={cycleUnit} className="w-full" title="Tap to change units">
            <p className="text-4xl font-bold tabular-nums text-foreground">
              {currentSpeed.toFixed(1)}
            </p>
            <p className="text-xs font-medium text-ocean">{UNIT_LABELS[unit]}</p>
          </button>

          {/* Heading */}
          {gps.heading !== null && (
            <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Navigation className="h-3 w-3" style={{ transform: `rotate(${gps.heading}deg)` }} />
              {Math.round(gps.heading)}°
            </div>
          )}

          {/* Max speed */}
          <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
            <span>Max: {maxSpeed.toFixed(1)} {UNIT_LABELS[unit]}</span>
            <button onClick={() => setMaxSpeed(0)} className="text-ocean hover:underline">Reset</button>
          </div>

          {/* Accuracy */}
          {gps.accuracy !== null && (
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              GPS ±{Math.round(gps.accuracy)}m
            </p>
          )}

          {/* Stop button */}
          <button
            onClick={stopTracking}
            className="mt-2 w-full rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Stop GPS
          </button>
        </div>
      )}
    </div>
  );
}
