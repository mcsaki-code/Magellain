"use client";

import { useWeatherStore } from "@/lib/store/weather-store";
import { useMapStore } from "@/lib/store/map-store";
import { BUOY_STATIONS, getWindColor } from "@/lib/constants";
import { X, Wind, Waves, Thermometer, Gauge } from "lucide-react";

function degToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function BuoyPanel() {
  const { selectedBuoy, setSelectedBuoy } = useMapStore();
  const { observations } = useWeatherStore();

  if (!selectedBuoy) return null;

  const station = BUOY_STATIONS.find((s) => s.id === selectedBuoy);
  const obs = observations[selectedBuoy];

  if (!station) return null;

  const windColor = getWindColor(obs?.wind_speed_kts ?? 0);

  return (
    <div className="absolute bottom-20 left-2 right-2 z-10 rounded-xl bg-card/95 p-4 shadow-xl backdrop-blur-sm sm:left-auto sm:right-4 sm:w-80">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{station.name}</h3>
          <p className="text-xs text-muted-foreground">Station {station.id}</p>
        </div>
        <button
          onClick={() => setSelectedBuoy(null)}
          className="rounded-full p-1 hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {obs ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Wind */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wind className="h-3.5 w-3.5" />
              Wind
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold" style={{ color: windColor }}>
                {obs.wind_speed_kts ?? "--"}
              </span>
              <span className="text-xs text-muted-foreground">kts</span>
            </div>
            {obs.wind_direction_deg !== null && (
              <p className="text-xs text-muted-foreground">
                {degToCompass(obs.wind_direction_deg)} ({obs.wind_direction_deg}°)
              </p>
            )}
            {obs.wind_gust_kts && (
              <p className="text-xs text-orange-500">Gusts {obs.wind_gust_kts} kts</p>
            )}
          </div>

          {/* Waves */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Waves className="h-3.5 w-3.5" />
              Waves
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-ocean">
                {obs.wave_height_ft ?? "--"}
              </span>
              <span className="text-xs text-muted-foreground">ft</span>
            </div>
            {obs.wave_period_sec && (
              <p className="text-xs text-muted-foreground">{obs.wave_period_sec}s period</p>
            )}
          </div>

          {/* Temperature */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Thermometer className="h-3.5 w-3.5" />
              Temperature
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold">{obs.air_temp_f ?? "--"}°</span>
              <span className="text-xs text-muted-foreground">air</span>
            </div>
            <p className="text-xs text-ocean">{obs.water_temp_f ?? "--"}° water</p>
          </div>

          {/* Pressure */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              Pressure
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold">
                {obs.barometric_pressure_mb ?? "--"}
              </span>
              <span className="text-xs text-muted-foreground">mb</span>
            </div>
          </div>

          {/* Timestamp */}
          <div className="col-span-2 text-center text-xs text-muted-foreground">
            Observed {obs.observed_at ? new Date(obs.observed_at).toLocaleString() : "N/A"}
          </div>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No recent observations available
        </p>
      )}
    </div>
  );
}
