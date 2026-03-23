"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { useWeatherStore } from "@/lib/store/weather-store";
import { BUOY_STATIONS, getWindColor, WIND_COLORS } from "@/lib/constants";
import { Wind, Waves, Thermometer, Gauge, AlertTriangle, RefreshCw, CloudRain } from "lucide-react";

function degToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function WindLegend() {
  const entries = Object.values(WIND_COLORS).filter((w) => w.max !== Infinity);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {entries.map((w) => (
        <span key={w.label} className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: w.color }} />
          {w.label} (&lt;{w.max}kts)
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: WIND_COLORS.gale.color }} />
        Gale (25+)
      </span>
    </div>
  );
}

export default function WeatherPage() {
  const { observations, forecasts, alerts, isLoading, lastFetched, fetchWeather } = useWeatherStore();

  useEffect(() => {
    if (!lastFetched) fetchWeather();
  }, [lastFetched, fetchWeather]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Weather" />
      <div className="space-y-4 p-4">
        {/* Alerts banner */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={alert.alert_id ?? i}
                className={`rounded-lg border p-3 ${
                  alert.severity === "extreme" || alert.severity === "severe"
                    ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                    : "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{alert.headline}</p>
                    <p className="mt-1 text-xs opacity-80">{alert.description?.slice(0, 200)}...</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Refresh bar */}
        <div className="flex items-center justify-between">
          <WindLegend />
          <button
            onClick={fetchWeather}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Loading..." : lastFetched ? `Updated ${new Date(lastFetched).toLocaleTimeString()}` : "Refresh"}
          </button>
        </div>

        {/* Station cards */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">BUOY STATIONS</h2>
          {BUOY_STATIONS.map((station) => {
            const obs = observations[station.id];
            const windColor = getWindColor(obs?.wind_speed_kts ?? 0);
            return (
              <div key={station.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{station.name}</h3>
                    <p className="text-xs text-muted-foreground">{station.id}</p>
                  </div>
                  {obs?.observed_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(obs.observed_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {obs ? (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center">
                      <Wind className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                      <p className="text-xl font-bold" style={{ color: windColor }}>
                        {obs.wind_speed_kts ?? "--"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">kts wind</p>
                      {obs.wind_direction_deg !== null && (
                        <p className="text-[10px] text-muted-foreground">
                          {degToCompass(obs.wind_direction_deg)}
                        </p>
                      )}
                      {obs.wind_gust_kts && (
                        <p className="text-[10px] text-orange-500">G{obs.wind_gust_kts}</p>
                      )}
                    </div>
                    <div className="text-center">
                      <Waves className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                      <p className="text-xl font-bold text-ocean">{obs.wave_height_ft ?? "--"}</p>
                      <p className="text-[10px] text-muted-foreground">ft waves</p>
                      {obs.wave_period_sec && (
                        <p className="text-[10px] text-muted-foreground">{obs.wave_period_sec}s</p>
                      )}
                    </div>
                    <div className="text-center">
                      <Thermometer className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                      <p className="text-xl font-bold">{obs.air_temp_f ?? "--"}°</p>
                      <p className="text-[10px] text-muted-foreground">air</p>
                      <p className="text-[10px] text-ocean">{obs.water_temp_f ?? "--"}° water</p>
                    </div>
                    <div className="text-center">
                      <Gauge className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                      <p className="text-xl font-bold">{obs.barometric_pressure_mb ?? "--"}</p>
                      <p className="text-[10px] text-muted-foreground">mb</p>
                    </div>
                  </div>
                ) : (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    {isLoading ? "Loading..." : "No data available"}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Forecasts */}
        {forecasts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">MARINE FORECASTS</h2>
            {/* Group by zone */}
            {Array.from(new Set(forecasts.map((f) => f.zone_id))).map((zoneId) => {
              const zoneForecasts = forecasts.filter((f) => f.zone_id === zoneId);
              const zoneName = zoneForecasts[0]?.zone_name ?? zoneId;
              return (
                <div key={zoneId} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <CloudRain className="h-4 w-4 text-ocean" />
                    <h3 className="text-sm font-semibold">{zoneName}</h3>
                  </div>
                  <div className="space-y-2">
                    {zoneForecasts.map((fc, i) => (
                      <div key={i} className="border-t border-border/50 pt-2 first:border-0 first:pt-0">
                        <p className="text-xs font-medium text-muted-foreground">{fc.period_name}</p>
                        <p className="mt-0.5 text-sm">{fc.forecast_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
