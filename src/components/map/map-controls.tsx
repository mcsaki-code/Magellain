"use client";

import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { Layers, RotateCcw, RefreshCw, Anchor, Navigation } from "lucide-react";
import { useState } from "react";
import { FORD_YC } from "@/lib/constants";

export function MapControls() {
  const [showLayers, setShowLayers] = useState(false);
  const {
    showBuoyMarkers,
    showWindArrows,
    toggleBuoyMarkers,
    toggleWindArrows,
    resetView,
    setCenter,
    setZoom,
    showLaylines,
    toggleLaylines,
    tackingAngle,
    setTackingAngle,
  } = useMapStore();
  const { fetchWeather, isLoading, lastFetched } = useWeatherStore();

  return (
    <div className="absolute left-2 top-2 z-10 flex flex-col gap-1.5">
      {/* Layers toggle */}
      <button
        onClick={() => setShowLayers(!showLayers)}
        className="rounded-xl bg-card/92 p-2.5 shadow-lg backdrop-blur-md hover:bg-card active:scale-95 transition-transform"
        title="Map layers"
      >
        <Layers className="h-5 w-5 text-foreground" />
      </button>

      {showLayers && (
        <div className="rounded-xl bg-card/97 p-3 shadow-xl backdrop-blur-md min-w-[168px]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Layers
          </p>
          <label className="mb-1.5 flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showBuoyMarkers}
              onChange={toggleBuoyMarkers}
              className="rounded accent-ocean"
            />
            Buoy Stations
          </label>
          <label className="mb-1.5 flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showWindArrows}
              onChange={toggleWindArrows}
              className="rounded accent-ocean"
            />
            Wind Arrows
          </label>
          <label className="mb-1 flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showLaylines}
              onChange={toggleLaylines}
              className="rounded accent-ocean"
            />
            Laylines
          </label>
          {showLaylines && (
            <div className="mb-1 ml-5 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Tacking °</span>
              <input
                type="range"
                min={30}
                max={55}
                step={1}
                value={tackingAngle}
                onChange={(e) => setTackingAngle(Number(e.target.value))}
                className="h-1 w-16 accent-ocean"
              />
              <span className="w-8 text-[10px] font-bold text-ocean">{tackingAngle}°</span>
            </div>
          )}
          <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
            <button
              onClick={() => { setCenter([FORD_YC.lng, FORD_YC.lat]); setZoom(13); setShowLayers(false); }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              <Anchor className="h-3 w-3" /> Zoom to FYC
            </button>
            <button
              onClick={() => { resetView(); setShowLayers(false); }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              <Navigation className="h-3 w-3" /> All Stations
            </button>
          </div>
        </div>
      )}

      {/* Reset view */}
      <button
        onClick={resetView}
        className="rounded-xl bg-card/92 p-2.5 shadow-lg backdrop-blur-md hover:bg-card active:scale-95 transition-transform"
        title="Reset map view"
      >
        <RotateCcw className="h-5 w-5 text-foreground" />
      </button>

      {/* Refresh weather data */}
      <button
        onClick={() => { fetchWeather(); }}
        disabled={isLoading}
        className="rounded-xl bg-card/92 p-2.5 shadow-lg backdrop-blur-md hover:bg-card disabled:opacity-50 active:scale-95 transition-transform"
        title={lastFetched ? `Updated ${new Date(lastFetched).toLocaleTimeString()}` : "Refresh weather"}
      >
        <RefreshCw className={`h-5 w-5 text-foreground ${isLoading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
