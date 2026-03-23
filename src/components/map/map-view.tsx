"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { BUOY_STATIONS, CLUBS } from "@/lib/constants";
import { getWindColor } from "@/lib/constants";

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const { center, zoom, showBuoyMarkers, setSelectedBuoy } = useMapStore();
  const { observations, fetchWeather } = useWeatherStore();

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const addBuoyMarkers = useCallback(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!showBuoyMarkers) return;

    BUOY_STATIONS.forEach((station) => {
      const obs = observations[station.id];
      const windSpeed = obs?.wind_speed_kts ?? 0;
      const windDir = obs?.wind_direction_deg;
      const color = getWindColor(windSpeed);

      // Create custom marker element
      const el = document.createElement("div");
      el.className = "buoy-marker";
      el.style.cssText = `
        width: 40px; height: 40px; border-radius: 50%;
        background: ${color}; border: 2px solid white;
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: 700; font-size: 11px;
        cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      `;
      el.textContent = windSpeed > 0 ? `${Math.round(windSpeed)}` : "--";

      // Wind direction arrow
      if (windDir !== null && windDir !== undefined) {
        const arrow = document.createElement("div");
        arrow.style.cssText = `
          position: absolute; top: -10px; left: 50%;
          transform: translateX(-50%) rotate(${windDir}deg);
          width: 0; height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 10px solid white;
        `;
        el.appendChild(arrow);
      }

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([station.lng, station.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
            <div style="font-family: system-ui; padding: 4px;">
              <strong>${station.name}</strong><br/>
              <span style="font-size: 12px; color: #666;">${station.id}</span><br/>
              ${obs ? `
                Wind: ${obs.wind_speed_kts ?? "--"} kts @ ${obs.wind_direction_deg ?? "--"}°
                ${obs.wind_gust_kts ? ` (G ${obs.wind_gust_kts})` : ""}<br/>
                Waves: ${obs.wave_height_ft ?? "--"} ft / ${obs.wave_period_sec ?? "--"}s<br/>
                Air: ${obs.air_temp_f ?? "--"}°F | Water: ${obs.water_temp_f ?? "--"}°F
              ` : "No data available"}
            </div>
          `)
        )
        .addTo(map.current!);

      el.addEventListener("click", () => setSelectedBuoy(station.id));
      markersRef.current.push(marker);
    });

    // Add club markers
    CLUBS.forEach((club) => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 4px;
        background: #1B2A4A; border: 2px solid white;
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: 700; font-size: 9px;
        cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      `;
      el.textContent = club.shortName;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([club.lng, club.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(`
            <div style="font-family: system-ui; padding: 4px;">
              <strong>${club.name}</strong>
            </div>
          `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [observations, showBuoyMarkers, setSelectedBuoy]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!token) return;

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center,
      zoom,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right"
    );

    map.current.on("load", () => {
      addBuoyMarkers();
    });

    // Fetch weather data
    fetchWeather();

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Update markers when observations change
  useEffect(() => {
    if (map.current?.isStyleLoaded()) {
      addBuoyMarkers();
    }
  }, [observations, showBuoyMarkers, addBuoyMarkers]);

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
