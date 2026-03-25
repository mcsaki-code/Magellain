"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMapStore } from "@/lib/store/map-store";
import { useWeatherStore } from "@/lib/store/weather-store";
import { createClient } from "@/lib/supabase/client";
import { BUOY_STATIONS, CLUBS, getWindColor } from "@/lib/constants";

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const courseMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const mapReady = useRef(false);
  const [debugInfo, setDebugInfo] = useState("");
  const [raceMarks, setRaceMarks] = useState<Array<{ id: string; name: string; short_name: string; latitude: number; longitude: number; mark_type: string; color: string | null }>>([]);

  const { center, zoom, showBuoyMarkers, setSelectedBuoy, showCourseOverlay, courseLegs, selectedCourse, activeTrackPoints, playbackIndex } = useMapStore();
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

  // Fetch race marks from Supabase
  useEffect(() => {
    const fetchRaceMarks = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("race_marks")
        .select("id, name, short_name, latitude, longitude, mark_type, color")
        .eq("is_active", true);
      if (data) setRaceMarks(data);
    };
    fetchRaceMarks();
  }, []);

  // Sync course overlay (race mark dots + course line)
  const syncCourseOverlay = useCallback(() => {
    const m = map.current;
    if (!m || !mapReady.current) return;

    // Remove old course markers
    courseMarkersRef.current.forEach((mk) => mk.remove());
    courseMarkersRef.current = [];

    // Remove old course line layer and source
    if (m.getLayer("course-line-layer")) m.removeLayer("course-line-layer");
    if (m.getLayer("course-line-arrows")) m.removeLayer("course-line-arrows");
    if (m.getSource("course-line")) m.removeSource("course-line");

    if (!showCourseOverlay) return;

    // Add race mark markers (small diamonds)
    for (const mark of raceMarks) {
      // Skip the virtual S/F mark
      if (mark.mark_type === "virtual") continue;

      const el = document.createElement("div");
      const isOnCourse = courseLegs.some((leg) => leg.mark.id === mark.id);
      const bgColor = isOnCourse ? "#0ea5e9" : "#6b7280"; // ocean blue if on course, gray otherwise
      const size = isOnCourse ? "24px" : "18px";

      Object.assign(el.style, {
        width: size,
        height: size,
        borderRadius: mark.mark_type === "light" ? "2px" : "50%",
        background: bgColor,
        border: "2px solid white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: "800",
        fontSize: isOnCourse ? "9px" : "7px",
        cursor: "pointer",
        boxShadow: isOnCourse
          ? "0 0 8px rgba(14,165,233,0.5), 0 2px 6px rgba(0,0,0,0.3)"
          : "0 2px 4px rgba(0,0,0,0.3)",
        transform: mark.mark_type === "light" ? "rotate(45deg)" : "none",
        zIndex: isOnCourse ? "5" : "3",
      });

      const label = document.createElement("span");
      label.textContent = mark.short_name;
      if (mark.mark_type === "light") {
        label.style.transform = "rotate(-45deg)";
      }
      el.appendChild(label);

      const popup = new mapboxgl.Popup({
        offset: 15,
        closeButton: false,
      }).setHTML(
        `<div style="font-family:system-ui;padding:4px">
          <strong>${mark.name}</strong><br/>
          <span style="font-size:11px;color:#666">${mark.short_name} — ${mark.mark_type}</span><br/>
          <span style="font-size:11px;color:#888">${mark.latitude.toFixed(4)}°N, ${Math.abs(mark.longitude).toFixed(4)}°W</span>
        </div>`
      );

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([mark.longitude, mark.latitude])
        .setPopup(popup)
        .addTo(m);

      courseMarkersRef.current.push(marker);
    }

    // Draw course line if a course is selected
    if (selectedCourse && courseLegs.length >= 2) {
      const coordinates = courseLegs.map((leg) => [
        leg.mark.longitude,
        leg.mark.latitude,
      ]);

      m.addSource("course-line", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      });

      m.addLayer({
        id: "course-line-layer",
        type: "line",
        source: "course-line",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#0ea5e9",
          "line-width": 3,
          "line-opacity": 0.8,
          "line-dasharray": [2, 1],
        },
      });
    }
  }, [showCourseOverlay, raceMarks, courseLegs, selectedCourse]);

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
      syncCourseOverlay();
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
      courseMarkersRef.current.forEach((mk) => mk.remove());
      courseMarkersRef.current = [];
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

  // Sync course overlay whenever course data or toggle changes
  useEffect(() => {
    if (mapReady.current) {
      syncCourseOverlay();
    }
  }, [showCourseOverlay, raceMarks, courseLegs, selectedCourse, syncCourseOverlay]);

  // Handle track replay line rendering
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady.current) return;

    // Remove old track layers and sources if they exist
    if (m.getLayer("track-replay-line")) m.removeLayer("track-replay-line");
    if (m.getLayer("track-replay-point-layer")) m.removeLayer("track-replay-point-layer");
    if (m.getSource("track-replay")) m.removeSource("track-replay");
    if (m.getSource("track-replay-point")) m.removeSource("track-replay-point");

    if (!activeTrackPoints || activeTrackPoints.length === 0) {
      return;
    }

    // Add track line as GeoJSON source and layer
    const lineCoordinates = activeTrackPoints.map((pt) => [pt.lng, pt.lat]);

    m.addSource("track-replay", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: lineCoordinates,
        },
      },
    });

    m.addLayer({
      id: "track-replay-line",
      type: "line",
      source: "track-replay",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#F97316", // orange
        "line-width": 3,
        "line-opacity": 0.8,
      },
    });

    // Add starting point marker
    m.addSource("track-replay-point", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [activeTrackPoints[0].lng, activeTrackPoints[0].lat],
        },
      },
    });

    m.addLayer({
      id: "track-replay-point-layer",
      type: "circle",
      source: "track-replay-point",
      paint: {
        "circle-color": "#F97316", // orange
        "circle-radius": 7,
        "circle-opacity": 1,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    console.log("[MagellAIn] Track replay layers added, points:", activeTrackPoints.length);
  }, [activeTrackPoints]);

  // Handle playback point position updates
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady.current || !activeTrackPoints || activeTrackPoints.length === 0) {
      return;
    }

    // Clamp playbackIndex to valid range
    const validIndex = Math.max(0, Math.min(playbackIndex, activeTrackPoints.length - 1));
    const point = activeTrackPoints[validIndex];

    const source = m.getSource("track-replay-point");
    if (source && "setData" in source) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [point.lng, point.lat],
        },
      });
    }
  }, [activeTrackPoints, playbackIndex]);

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
