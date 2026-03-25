"use client";

import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { Layers, RotateCcw, RefreshCw, Anchor, Navigation, Flag, TrendingUp } from "lucide-react";
import { useState } from "react";
import { FORD_YC } from "@/lib/constants";
import { cn } from "@/lib/utils";

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
    showStartLineTool,
    setShowStartLineTool,
    showWindShift,
    toggleWindShift,
  } = useMapStore();
  const { fetchWeather, isLoading, lastFetched } = useWeatherStore();

  return (
    <div className="absolute left-2 top-2 z-10 flex flex-col gap-2">
      {/* Layers toggle */}
      <button
        onClick={() => setShowLayers(!showLayers)}
        className="rounded-lg bg-card/90 p-2 shadow-md backdrop-blur-sm hover:bg-card"
      >
        <Layers className="h-5 w-5 text-foreground" />
      </button>

      {showLayers && (
        <div className="rounded-lg bg-card/95 p-3 shadow-lg backdrop-blur-sm">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">LAYERS</p>
          <label className="mb-1.5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showBuoyMarkers}
              onChange={toggleBuoyMarkers}
              className="rounded"
            />
            Buoy Stations
          </label>
          <label className="mb-1.5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showWindArrows}
              onChange={toggleWindArrows}
              className="rounded"
            />
            Wind Arrows
          </label>
          <label className="mb-1.5 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showWindShift}
              onChange={toggleWindShift}
              className="rounded"
            />
            Wind Shift Graph
          </label>
          <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
            <button
              onClick={() => { setCenter([FORD_YC.lng, FORD_YC.lat]); setZoom(13); }}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              <Anchor className="h-3 w-3" /> Zoom to FYC
            </button>
            <button
              onClick={() => resetView()}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              <Navigation className="h-3 w-3" /> Show All Stations
            </button>
          </div>
        </div>
      )}

      {/* Reset view */}
      <button
        onClick={resetView}
        className="rounded-lg bg-card/90 p-2 shadow-md backdrop-blur-sm hover:bg-card"
        title="Show all stations"
      >
        <RotateCcw className="h-5 w-5 text-foreground" />
      </button>

      {/* Refresh data */}
      <button
        onClick={() => { fetchWeather(); }}
        disabled={isLoading}
        className="rounded-lg bg-card/90 p-2 shadow-md backdrop-blur-sm hover:bg-card disabled:opacity-50"
        title={lastFetched ? `Last updated: ${new Date(lastFetched).toLocaleTimeString()}` : "Refresh weather"}
      >
        <RefreshCw className={`h-5 w-5 text-foreground ${isLoading ? "animate-spin" : ""}`} />
      </button>

      {/* Start Line Bias tool */}
      <button
        onClick={() => setShowStartLineTool(!showStartLineTool)}
        className={cn(
          "rounded-lg p-2 shadow-md backdrop-blur-sm",
          showStartLineTool
            ? "bg-ocean text-white"
            : "bg-card/90 hover:bg-card text-foreground"
        )}
        title="Start Line Bias"
      >
        <Flag className="h-5 w-5" />
      </button>

      {/* Wind Shift graph */}
      <button
        onClick={toggleWindShift}
        className={cn(
          "rounded-lg p-2 shadow-md backdrop-blur-sm",
          showWindShift
            ? "bg-ocean text-white"
            : "bg-card/90 hover:bg-card text-foreground"
        )}
        title="Wind Shifts"
      >
        <TrendingUp className="h-5 w-5" />
      </button>
    </div>
  );
}
