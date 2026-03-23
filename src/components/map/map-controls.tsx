"use client";

import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { Layers, RotateCcw, RefreshCw } from "lucide-react";
import { useState } from "react";

export function MapControls() {
  const [showLayers, setShowLayers] = useState(false);
  const { showBuoyMarkers, showWindArrows, toggleBuoyMarkers, toggleWindArrows, resetView } = useMapStore();
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showWindArrows}
              onChange={toggleWindArrows}
              className="rounded"
            />
            Wind Arrows
          </label>
        </div>
      )}

      {/* Reset view */}
      <button
        onClick={resetView}
        className="rounded-lg bg-card/90 p-2 shadow-md backdrop-blur-sm hover:bg-card"
        title="Reset view"
      >
        <RotateCcw className="h-5 w-5 text-foreground" />
      </button>

      {/* Refresh data */}
      <button
        onClick={fetchWeather}
        disabled={isLoading}
        className="rounded-lg bg-card/90 p-2 shadow-md backdrop-blur-sm hover:bg-card disabled:opacity-50"
        title={lastFetched ? `Last updated: ${new Date(lastFetched).toLocaleTimeString()}` : "Refresh weather"}
      >
        <RefreshCw className={`h-5 w-5 text-foreground ${isLoading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
