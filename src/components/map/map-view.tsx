"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { BUOY_STATIONS, CLUBS, getWindColor } from "@/lib/constants";

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const mapReady = useRef(false);
  const [debugInfo, setDebugInfo] = useState("");

  const { center, zoom, showBuoyMarkers, setSelectedBuoy } = useMapStore();
  const { observations, fetchWeather, isLoading: weatherLoading } = useWeatherStore();

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Store latest observations in a ref so the load callback can access them
  const observationsRef = useRef(observations);
  observationsRef.current = observations;

  const showMarkersRef = useRef(showBuoyMarkers);
  showMarkersRef.current = showBuoyMarkers;

  const syncMarkers = useCallback(() => {
    const m = map.current;
    if (!m) {
      console.log("[MagellAIn] syncMarkers: no map instance");
      return;
    }
    if (!mapReady.current) {
      console.log("[MagellAIn] syncMarkers: map not ready yet");
      return;
    }

    // Remove old markers
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    if (!showMarkersRef.current) {
      console.log("[MagellAIn] syncMarkers: markers toggled off");
      return;
    }

    const obs = observationsRef.current;
    const stationCount = Object.keys(obs).length;
    console.log("[MagellAIn] syncMarkers: building markers, stations with data:", stationCount);

    // Buoy station markers
    for (const station of BUOY_STATIONS) {
      const stationObs = obs[station.id];
      const windSpeed = stationObs?.wind_speed_kts ?? 0;
      const windDir = stationObs?.wind_direction_deg;
      const color = getWindColor(windSpeed);

      // Always use a wrapper for consistent sizing
      const wrapper = document.createElement("div");
      wrapper.className = "magellain-marker";
      Object.assign(wrapper.style, {
        position: "relative",
        width: "42px",
        height: "56px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        cursor: "pointer",
        zIndex: "10",
        pointerEvents: "auto",
      });

      // Wind direction arrow above the circle
      if (windDir != null) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "14");
        svg.setAttribute("height", "14");
        svg.setAttribute("viewBox", "0 0 16 16");
        Object.assign(svg.style, {
          transform: `rotate(${windDir}deg)`,
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
          marginBottom: "1px",
          flexShrink: "0",
        });
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M8 0L12 10H4Z");
        path.setAttribute("fill", color);
        path.setAttribute("stroke", "white");
        path.setAttribute("stroke-width", "1");
        svg.appendChild(path);
        wrapper.appendChild(svg);
      }

      // The circle with wind speed
      const circle = document.createElement("div");
      Object.assign(circle.style, {
        width: "38px",
        height: "38px",
        borderRadius: "50%",
        background: color,
        border: "2.5px solid white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: "700",
        fontSize: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        lineHeight: "1",
        flexShrink: "0",
      });
      circle.textContent = windSpeed > 0 ? `${Math.round(windSpeed)}` : "--";
      wrapper.appendChild(circle);

      const popupContent = buildPopupHtml(station, stationObs);
      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
        .setLngLat([station.lng, station.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(popupContent))
        .addTo(m);
      wrapper.addEventListener("click", () => setSelectedBuoy(station.id));
      markersRef.current.push(marker);
      console.log(`[MagellAIn] Added marker: ${station.name} at [${station.lng}, ${station.lat}] wind=${windSpeed}kts`);
    }

    // Club markers
    for (const club of CLUBS) {
      const el = document.createElement("div");
      Object.assign(el.style, {
        width: "30px",
        height: "30px",
        borderRadius: "5px",
        background: "#1B2A4A",
        border: "2px solid white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: "700",
        fontSize: "9px",
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      });
      el.textContent = club.shortName;

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([club.lng, club.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
            `<div style="font-family:system-ui;padding:4px"><strong>${club.name}</strong></div>`
          )
        )
        .addTo(m);
      markersRef.current.push(marker);
    }

    const total = markersRef.current.length;
    console.log(`[MagellAIn] Total markers placed: ${total}`);
    setDebugInfo(`${stationCount} stations | ${total} markers`);
  }, [setSelectedBuoy]);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || !token) return;
    // If map already exists, skip re-init
    if (map.current) return;

    console.log("[MagellAIn] Initializing Mapbox map...");
    mapboxgl.accessToken = token;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center,
      zoom,
      attributionControl: false,
    });

    map.current = mapInstance;

    mapInstance.addControl(new mapboxgl.NavigationControl(), "top-right");

    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    });
    mapInstance.addControl(geolocate, "top-right");

    mapInstance.on("load", () => {
      mapReady.current = true;
      console.log("[MagellAIn] Map style loaded, syncing markers...");
      syncMarkers();
      console.log("[MagellAIn] After initial sync, markers:", markersRef.current.length);
      // Auto-trigger user location after map loads
      setTimeout(() => {
        try { geolocate.trigger(); } catch { /* user may deny permission */ }
      }, 500);
    });

    // Fallback: if style.load already fired (can happen with caching), force sync
    mapInstance.once("idle", () => {
      console.log("[MagellAIn] Map idle event, mapReady:", mapReady.current, "markers:", markersRef.current.length);
      if (!mapReady.current) {
        // Style may have loaded before our listener was attached
        mapReady.current = true;
      }
      if (markersRef.current.length === 0) {
        console.log("[MagellAIn] Idle fallback: syncing markers");
        syncMarkers();
      }
    });

    // Kick off weather data fetch
    fetchWeather();

    return () => {
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      mapReady.current = false;
      mapInstance.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Fly to new center/zoom when store changes (e.g. from controls)
  useEffect(() => {
    if (!map.current || !mapReady.current) return;
    map.current.flyTo({ center, zoom, duration: 1000 });
  }, [center, zoom]);

  // Re-sync markers whenever observations or toggle changes
  useEffect(() => {
    const stationCount = Object.keys(observations).length;
    console.log("[MagellAIn] Observations changed, stations:", stationCount, "mapReady:", mapReady.current);
    if (mapReady.current) {
      syncMarkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observations, showBuoyMarkers, syncMarkers]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-navy-900 p-8 text-center">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">Map Not Configured</h2>
          <p className="text-sm text-navy-300">
            Add your Mapbox token as NEXT_PUBLIC_MAPBOX_TOKEN in .env.local to enable the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />
      {/* Weather loading/debug indicator */}
      {(weatherLoading || debugInfo) && (
        <div className="absolute bottom-2 left-2 z-10 rounded-lg bg-card/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur-sm">
          {weatherLoading ? "Loading weather..." : debugInfo}
        </div>
      )}
    </div>
  );
}

function buildPopupHtml(
  station: { name: string; id: string },
  obs: { wind_speed_kts?: number | null; wind_direction_deg?: number | null; wind_gust_kts?: number | null; wave_height_ft?: number | null; wave_period_sec?: number | null; air_temp_f?: number | null; water_temp_f?: number | null } | undefined
) {
  return `<div style="font-family:system-ui;padding:4px">
    <strong>${station.name}</strong><br/>
    <span style="font-size:12px;color:#666">${station.id}</span><br/>
    ${obs ? `Wind: ${obs.wind_speed_kts ?? "--"} kts @ ${obs.wind_direction_deg ?? "--"}&deg;${obs.wind_gust_kts ? ` (G ${obs.wind_gust_kts})` : ""}<br/>Waves: ${obs.wave_height_ft ?? "--"} ft / ${obs.wave_period_sec ?? "--"}s<br/>Air: ${obs.air_temp_f ?? "--"}&deg;F | Water: ${obs.water_temp_f ?? "--"}&deg;F` : "No data available"}
  </div>`;
}
