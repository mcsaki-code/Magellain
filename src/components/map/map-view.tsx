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
  const mapReady = useRef(false);

  const { center, zoom, showBuoyMarkers, setSelectedBuoy } = useMapStore();
  const { observations, fetchWeather } = useWeatherStore();

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const addBuoyMarkers = useCallback(() => {
    if (!map.current || !mapReady.current) return;

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
      el.style.width = "40px";
      el.style.height = "40px";
      el.style.borderRadius = "50%";
      el.style.background = color;
      el.style.border = "2px solid white";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.color = "white";
      el.style.fontWeight = "700";
      el.style.fontSize = "11px";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      el.style.position = "relative";
      el.style.zIndex = "10";
      el.textContent = windSpeed > 0 ? `${Math.round(windSpeed)}` : "--";

      // Wind direction arrow
      if (windDir !== null && windDir !== undefined) {
        const arrow = document.createElement("div");
        arrow.style.position = "absolute";
        arrow.style.top = "-10px";
        arrow.style.left = "50%";
        arrow.style.transform = `translateX(-50%) rotate(${windDir}deg)`;
        arrow.style.width = "0";
        arrow.style.height = "0";
        arrow.style.borderLeft = "4px solid transparent";
        arrow.style.borderRight = "4px solid transparent";
        arrow.style.borderBottom = "10px solid white";
        el.appendChild(arrow);
      }

      const popupHtml = `
        <div style="font-family: system-ui; padding: 4px;">
          <strong>${station.name}</strong><br/>
          <span style="font-size: 12px; color: #666;">${station.id}</span><br/>
          ${obs ? `
            Wind: ${obs.wind_speed_kts ?? "--"} kts @ ${obs.wind_direction_deg ?? "--"}&deg;
            ${obs.wind_gust_kts ? ` (G ${obs.wind_gust_kts})` : ""}<br/>
            Waves: ${obs.wave_height_ft ?? "--"} ft / ${obs.wave_period_sec ?? "--"}s<br/>
            Air: ${obs.air_temp_f ?? "--"}&deg;F | Water: ${obs.water_temp_f ?? "--"}&deg;F
          ` : "No data available"}
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([station.lng, station.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(popupHtml)
        )
        .addTo(map.current!);

      el.addEventListener("click", () => setSelectedBuoy(station.id));
      markersRef.current.push(marker);
    });

    // Add club markers
    CLUBS.forEach((club) => {
      const el = document.createElement("div");
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.borderRadius = "4px";
      el.style.background = "#1B2A4A";
      el.style.border = "2px solid white";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.color = "white";
      el.style.fontWeight = "700";
      el.style.fontSize = "9px";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
      el.style.zIndex = "10";
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

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center,
      zoom,
      attributionControl: false,
    });

    map.current = mapInstance;

    mapInstance.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapInstance.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right"
    );

    mapInstance.on("load", () => {
      mapReady.current = true;
      addBuoyMarkers();
    });

    // Fetch weather data
    fetchWeather();

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapReady.current = false;
      mapInstance.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Update markers when observations change or buoy toggle changes
  useEffect(() => {
    if (!map.current || !mapReady.current) return;
    addBuoyMarkers();
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
