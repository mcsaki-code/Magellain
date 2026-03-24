"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/layout/header";
import { useWeatherStore } from "@/lib/store/weather-store";
import { createClient } from "@/lib/supabase/client";
import { BUOY_STATIONS, FORD_YC, getWindColor } from "@/lib/constants";
import {
  Wind, Waves, Thermometer, Gauge, Ship, Flag, Map,
  MessageSquare, Cloud, ChevronRight, Settings,
  User, Navigation, Calendar, Sailboat, Anchor,
  Newspaper, ExternalLink, Loader2,
} from "lucide-react";
import type { Boat, Regatta, Race } from "@/lib/types";

interface NextRaceInfo {
  regatta: Regatta & { club?: { name: string; short_name: string } };
  race: Race;
}

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  sourceIcon: string;
  pubDate: string;
  snippet: string;
  imageUrl: string | null;
}

export default function HomePage() {
  const { observations, alerts, sailingConditions, isLoading: weatherLoading, lastFetched, fetchWeather } = useWeatherStore();
  const [boat, setBoat] = useState<Boat | null>(null);
  const [nextRace, setNextRace] = useState<NextRaceInfo | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  // Fetch sailing news
  useEffect(() => {
    async function loadNews() {
      try {
        const res = await fetch("/api/news");
        if (res.ok) {
          const data = await res.json();
          setNews(data.news || []);
        }
      } catch (err) {
        console.warn("Failed to load news:", err);
      }
      setNewsLoading(false);
    }
    loadNews();
  }, []);

  // Fetch weather on mount
  useEffect(() => {
    if (!lastFetched) fetchWeather();
  }, [lastFetched, fetchWeather]);

  // Fetch user data
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setIsLoggedIn(true);

        // Get profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, full_name")
          .eq("id", user.id)
          .single();
        if (profile) {
          setUserName(profile.display_name || profile.full_name || user.email?.split("@")[0] || null);
        }

        // Get primary boat — fall back to Impetuous for admin/demo
        const DEMO_BOAT_ID = "d3099269-e402-4c95-b47a-74cd1bb4164c";
        const { data: ownBoat } = await supabase
          .from("boats")
          .select("*")
          .eq("owner_id", user.id)
          .eq("is_primary", true)
          .single();
        if (ownBoat) {
          setBoat(ownBoat as Boat);
        } else {
          // Admin mirror / demo: show Impetuous
          const { data: fallback } = await supabase
            .from("boats")
            .select("*")
            .eq("id", DEMO_BOAT_ID)
            .single();
          if (fallback) setBoat(fallback as Boat);
        }
      }
      setLoadingUser(false);
    }
    load();
  }, []);

  // Fetch next upcoming race
  useEffect(() => {
    async function loadNextRace() {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { data: regattas } = await supabase
        .from("regattas")
        .select("*, club:clubs(name, short_name)")
        .eq("is_active", true)
        .gte("end_date", now.split("T")[0])
        .order("start_date", { ascending: true })
        .limit(5);

      if (!regattas?.length) return;

      for (const regatta of regattas) {
        const { data: races } = await supabase
          .from("races")
          .select("*")
          .eq("regatta_id", regatta.id)
          .eq("status", "scheduled")
          .gte("scheduled_start", now)
          .order("scheduled_start", { ascending: true })
          .limit(1);

        if (races?.length) {
          setNextRace({ regatta: regatta as NextRaceInfo["regatta"], race: races[0] as Race });
          return;
        }
      }
    }
    loadNextRace();
  }, []);

  // Aggregate best data across all stations, prefer closest to FYC
  const allObs = BUOY_STATIONS.map((s) => {
    const dist = Math.sqrt(
      Math.pow(s.lat - FORD_YC.lat, 2) + Math.pow(s.lng - FORD_YC.lng, 2)
    );
    return { station: s, obs: observations[s.id], dist };
  })
    .filter((o) => o.obs)
    .sort((a, b) => a.dist - b.dist);

  // Build a composite observation from all stations, preferring closest
  const bestWind = allObs.find((o) => o.obs?.wind_speed_kts != null);
  const bestAirTemp = allObs.find((o) => o.obs?.air_temp_f != null);
  const bestWave = allObs.find((o) => o.obs?.wave_height_ft != null);
  const bestWaterTemp = allObs.find((o) => o.obs?.water_temp_f != null);
  const bestPressure = allObs.find((o) => o.obs?.barometric_pressure_mb != null);
  const stationCount = allObs.length;
  const hasAnyData = stationCount > 0;

  function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pb-2 pt-4 safe-top">
        <div>
          <Wordmark className="text-2xl" />
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loadingUser ? "" : userName ? `${greeting()}, ${userName}` : greeting()}
          </p>
        </div>
        <Link href="/menu" className="rounded-xl bg-muted p-2.5">
          {isLoggedIn ? (
            <User className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Settings className="h-5 w-5 text-muted-foreground" />
          )}
        </Link>
      </header>

      <div className="space-y-4 p-4">
        {/* Alerts banner */}
        {alerts.length > 0 && (
          <Link href="/weather" className="block rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                {alerts.length} Active Marine Alert{alerts.length > 1 ? "s" : ""}
              </span>
              <ChevronRight className="ml-auto h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">{alerts[0].headline}</p>
          </Link>
        )}

        {/* Sailing Conditions Card */}
        {sailingConditions && !weatherLoading && (
          <Link href="/weather" className="block">
            <section className={`rounded-xl border p-4 ${
              sailingConditions.rating === "excellent" ? "border-green-500/30 bg-green-500/5" :
              sailingConditions.rating === "good" ? "border-ocean/30 bg-ocean/5" :
              sailingConditions.rating === "fair" ? "border-yellow-500/30 bg-yellow-500/5" :
              sailingConditions.rating === "marginal" ? "border-orange-500/30 bg-orange-500/5" :
              "border-red-500/30 bg-red-500/5"
            }`}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">SAILING CONDITIONS</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                  sailingConditions.rating === "excellent" ? "bg-green-500/20 text-green-700 dark:text-green-400" :
                  sailingConditions.rating === "good" ? "bg-ocean/20 text-ocean" :
                  sailingConditions.rating === "fair" ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                  sailingConditions.rating === "marginal" ? "bg-orange-500/20 text-orange-700 dark:text-orange-400" :
                  "bg-red-500/20 text-red-700 dark:text-red-400"
                }`}>
                  {sailingConditions.rating.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm font-medium">{sailingConditions.summary}</p>
              {sailingConditions.tips.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {sailingConditions.tips[0]}
                </p>
              )}
            </section>
          </Link>
        )}

        {/* Current Conditions Card */}
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">CURRENT CONDITIONS</h2>
            <Link href="/weather" className="text-xs font-medium text-ocean">View All</Link>
          </div>

          {weatherLoading && !lastFetched ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-ocean border-t-transparent" />
            </div>
          ) : hasAnyData ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Wind */}
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <Wind className="h-5 w-5 shrink-0" style={{ color: getWindColor(bestWind?.obs?.wind_speed_kts ?? 0) }} />
                  <div>
                    <p className="text-lg font-bold">{bestWind?.obs?.wind_speed_kts ?? "--"} kts</p>
                    <p className="text-xs text-muted-foreground">
                      {bestWind?.obs?.wind_direction_deg != null ? `${bestWind.obs.wind_direction_deg}\u00B0` : "Wind"}
                      {bestWind?.obs?.wind_gust_kts ? ` G${bestWind.obs.wind_gust_kts}` : ""}
                    </p>
                  </div>
                </div>

                {/* Air temp — aggregated from any reporting station */}
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <Thermometer className="h-5 w-5 shrink-0 text-orange-400" />
                  <div>
                    <p className="text-lg font-bold">{bestAirTemp?.obs?.air_temp_f != null ? `${bestAirTemp.obs.air_temp_f}\u00B0F` : "--"}</p>
                    <p className="text-xs text-muted-foreground">Air temp</p>
                  </div>
                </div>

                {/* Waves — buoy data or NWS forecast fallback */}
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <Waves className="h-5 w-5 shrink-0 text-ocean" />
                  <div>
                    <p className="text-lg font-bold">
                      {bestWave?.obs?.wave_height_ft != null
                        ? `${bestWave.obs.wave_height_ft} ft`
                        : sailingConditions?.wave_ft
                          ? `${sailingConditions.wave_ft} ft`
                          : "--"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bestWave
                        ? "Wave height"
                        : sailingConditions?.wave_ft
                          ? "Waves (forecast)"
                          : "No wave data"}
                    </p>
                  </div>
                </div>

                {/* Water temp / pressure — aggregated */}
                {bestWaterTemp?.obs?.water_temp_f != null ? (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <Thermometer className="h-5 w-5 shrink-0 text-ocean-300" />
                    <div>
                      <p className="text-lg font-bold">{bestWaterTemp.obs.water_temp_f}\u00B0F</p>
                      <p className="text-xs text-muted-foreground">Water temp</p>
                    </div>
                  </div>
                ) : bestPressure?.obs?.barometric_pressure_mb != null ? (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <Gauge className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-bold">{bestPressure.obs.barometric_pressure_mb} mb</p>
                      <p className="text-xs text-muted-foreground">Pressure</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <Thermometer className="h-5 w-5 shrink-0 text-ocean-300" />
                    <div>
                      <p className="text-lg font-bold">--</p>
                      <p className="text-xs text-muted-foreground">Water temp</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 text-right text-xs text-muted-foreground">
                Detroit River area ({stationCount} station{stationCount !== 1 ? "s" : ""} reporting)
              </p>
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">
                No station data available yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Offshore buoys may not be deployed this early in the season. Shore stations should update shortly.
              </p>
            </div>
          )}
        </section>

        {/* My Boat Card */}
        {isLoggedIn && (
          <section className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">MY BOAT</h2>
              <Link href="/menu/boats" className="text-xs font-medium text-ocean">
                {boat ? "Edit" : "Add Boat"}
              </Link>
            </div>
            {boat ? (
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-ocean/10">
                  <Sailboat className="h-7 w-7 text-ocean" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{boat.name}</p>
                  <p className="text-sm text-muted-foreground">{boat.class_name}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {boat.sail_number && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs">Sail #{boat.sail_number}</span>
                    )}
                    {boat.phrf_rating && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs">PHRF {boat.phrf_rating}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/menu/boats/new"
                className="flex items-center gap-3 rounded-lg bg-muted/50 p-4"
              >
                <Ship className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Add your boat</p>
                  <p className="text-xs text-muted-foreground">
                    Set up your boat for personalized coaching
                  </p>
                </div>
              </Link>
            )}
          </section>
        )}

        {/* Next Race Card */}
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">NEXT RACE</h2>
            <Link href="/races" className="text-xs font-medium text-ocean">All Races</Link>
          </div>
          {nextRace ? (
            <Link href="/races" className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-ocean/10">
                <Calendar className="h-5 w-5 text-ocean" />
                <span className="mt-0.5 text-[10px] font-bold text-ocean">
                  {new Date(nextRace.race.scheduled_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-semibold">{nextRace.regatta.name}</p>
                <p className="text-sm text-muted-foreground">
                  Race {nextRace.race.race_number}
                  {nextRace.regatta.club ? ` \u00B7 ${nextRace.regatta.club.short_name}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(nextRace.race.scheduled_start).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  {" at "}
                  {new Date(nextRace.race.scheduled_start).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No upcoming races scheduled
            </p>
          )}
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-3">
          <Link href="/map" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted">
            <Map className="h-6 w-6 text-ocean" />
            <div>
              <p className="text-sm font-semibold">Chart</p>
              <p className="text-[11px] text-muted-foreground">Map & buoys</p>
            </div>
          </Link>
          <Link href="/weather" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted">
            <Cloud className="h-6 w-6 text-ocean" />
            <div>
              <p className="text-sm font-semibold">Weather</p>
              <p className="text-[11px] text-muted-foreground">Forecasts</p>
            </div>
          </Link>
          <Link href="/chat" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted">
            <MessageSquare className="h-6 w-6 text-ocean" />
            <div>
              <p className="text-sm font-semibold">AI Coach</p>
              <p className="text-[11px] text-muted-foreground">Tactics & strategy</p>
            </div>
          </Link>
          <Link href="/map" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted">
            <Navigation className="h-6 w-6 text-ocean" />
            <div>
              <p className="text-sm font-semibold">GPS Speed</p>
              <p className="text-[11px] text-muted-foreground">Speedometer</p>
            </div>
          </Link>
        </section>

        {/* Sailing News Feed */}
        <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Newspaper className="h-4 w-4" />
              SAILING NEWS
            </h2>
          </div>

          {newsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : news.length > 0 ? (
            <div className="divide-y">
              {news.slice(0, 8).map((item) => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  {item.imageUrl && (
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium leading-snug text-foreground line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {item.snippet}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {item.sourceIcon}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.source}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatTimeAgo(item.pubDate)}
                      </span>
                      <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground/40" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No sailing news available right now
            </p>
          )}
        </section>

        {/* Sign in prompt for anonymous users */}
        {!isLoggedIn && !loadingUser && (
          <section className="rounded-xl border border-ocean/30 bg-ocean/5 p-4 text-center">
            <Anchor className="mx-auto h-8 w-8 text-ocean" />
            <p className="mt-2 text-sm font-medium">Sign in for the full experience</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Set up your boat profile for personalized AI coaching, track races, and more.
            </p>
            <Link
              href="/sign-in"
              className="mt-3 inline-block rounded-xl bg-ocean px-6 py-2.5 text-sm font-semibold text-white"
            >
              Sign In
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
