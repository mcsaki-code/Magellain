"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { useWeatherStore } from "@/lib/store/weather-store";
import { BUOY_STATIONS, getWindColor, WIND_COLORS } from "@/lib/constants";
import { Wind, Waves, Thermometer, Gauge, AlertTriangle, RefreshCw, CloudRain, Sailboat } from "lucide-react";
import type { SailingConditions } from "@/lib/store/weather-store";

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
  const { observations, forecasts, alerts, sailingConditions, isLoading, lastFetched, fetchWeather } = useWeatherStore();

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

        {/* Sailing Conditions Analysis */}
        {sailingConditions && <SailingConditionsCard conditions={sailingConditions} />}

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
                    {isLoading ? "Loading..." : station.id.match(/^\d/) ? "Seasonal buoy \u2014 not yet deployed" : "No data available"}
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

const CONDITION_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  excellent: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-700 dark:text-green-400", label: "Excellent" },
  good: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-700 dark:text-blue-400", label: "Good" },
  fair: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-700 dark:text-yellow-400", label: "Fair" },
  marginal: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-700 dark:text-orange-400", label: "Marginal" },
  not_recommended: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-700 dark:text-red-400", label: "Not Recommended" },
};

function SailingConditionsCard({ conditions }: { conditions: SailingConditions }) {
  const style = CONDITION_STYLES[conditions.rating] ?? CONDITION_STYLES.fair;

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sailboat className={`h-5 w-5 ${style.text}`} />
          <h2 className="text-sm font-semibold text-muted-foreground">SAILING CONDITIONS</h2>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.text} ${style.bg}`}>
          {style.label}
        </span>
      </div>
      <p className="mb-3 text-sm">{conditions.summary}</p>
      <div className="mb-3 grid grid-cols-4 gap-3 text-center text-xs">
        <div>
          <p className="font-bold text-lg">{conditions.wind_kts}</p>
          <p className="text-muted-foreground">kts wind</p>
        </div>
        <div>
          <p className="font-bold text-lg">{conditions.gust_kts}</p>
          <p className="text-muted-foreground">kts gust</p>
        </div>
        <div>
          <p className="font-bold text-lg">{conditions.wave_ft}</p>
          <p className="text-muted-foreground">ft waves</p>
        </div>
        <div>
          <p className="font-bold text-lg">{conditions.has_precipitation ? "Yes" : "No"}</p>
          <p className="text-muted-foreground">precip</p>
        </div>
      </div>
      {conditions.tips.length > 0 && (
        <div className="space-y-1 border-t border-border/50 pt-2">
          {conditions.tips.map((tip, i) => (
            <p key={i} className="text-xs text-muted-foreground">- {tip}</p>
          ))}
        </div>
      )}
    </div>
  );
}
