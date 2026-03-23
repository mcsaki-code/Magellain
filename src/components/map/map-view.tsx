"use client";

import { useEffect, useRef } from "react";
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

  const { center, zoom, showBuoyMarkers, setSelectedBuoy } = useMapStore();
  const { observations, fetchWeather } = useWeatherStore();

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Store latest observations in a ref so the load callback can access them
  const observationsRef = useRef(observations);
  observationsRef.current = observations;

  const showMarkersRef = useRef(showBuoyMarkers);
  showMarkersRef.current = showBuoyMarkers;

  function syncMarkers() {
    const m = map.current;
    if (!m || !mapReady.current) return;

    // Remove old markers
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    if (!showMarkersRef.current) return;

    const obs = observationsRef.current;

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
  }

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || map.current || !token) return;

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
      console.log("[MagellAIn] Map loaded, syncing markers...");
      syncMarkers();
      console.log("[MagellAIn] Markers created:", markersRef.current.length);
      // Auto-trigger user location after map loads
      setTimeout(() => {
        try { geolocate.trigger(); } catch { /* user may deny permission */ }
      }, 500);
    });

    // Also listen for idle (all tiles loaded) as a fallback sync
    mapInstance.once("idle", () => {
      if (mapReady.current && markersRef.current.length === 0) {
        console.log("[MagellAIn] Idle fallback: re-syncing markers");
        syncMarkers();
      }
    });

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

  // Re-sync markers whenever observations or toggle changes
  useEffect(() => {
    console.log("[MagellAIn] Observations changed, stations:", Object.keys(observations).length, "mapReady:", mapReady.current);
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observations, showBuoyMarkers]);

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

  return <div ref={mapContainer} className="h-full w-full" />;
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
