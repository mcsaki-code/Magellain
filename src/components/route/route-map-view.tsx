"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useRouteStore, computeTotalDistance, computeBearing } from "@/lib/store/route-store";
import type { Waypoint, PassageRoute } from "@/lib/store/route-store";

// ─── Numbered Marker Element ──────────────────────────────

function createWaypointMarkerElement(index: number, isDraft: boolean): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "route-waypoint-marker";
  Object.assign(wrapper.style, {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: isDraft ? "grab" : "pointer",
    zIndex: "20",
    pointerEvents: "auto",
  });

  // Pin shape: circle with number
  const circle = document.createElement("div");
  Object.assign(circle.style, {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: isDraft ? "#0ea5e9" : "#1B2A4A",
    border: "2.5px solid white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: "800",
    fontSize: "12px",
    boxShadow: isDraft
      ? "0 0 10px rgba(14,165,233,0.4), 0 2px 6px rgba(0,0,0,0.3)"
      : "0 2px 6px rgba(0,0,0,0.3)",
    lineHeight: "1",
    transition: "transform 0.15s ease",
  });
  circle.textContent = String(index + 1);
  wrapper.appendChild(circle);

  // Pin tail
  const tail = document.createElement("div");
  Object.assign(tail.style, {
    width: "0",
    height: "0",
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderTop: `6px solid ${isDraft ? "#0ea5e9" : "#1B2A4A"}`,
    marginTop: "-1px",
  });
  wrapper.appendChild(tail);

  return wrapper;
}

// ─── Distance Label Element ───────────────────────────────

function createDistanceLabel(distance: number, bearing: number): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    background: "rgba(14,165,233,0.9)",
    color: "white",
    padding: "2px 6px",
    borderRadius: "8px",
    fontSize: "10px",
    fontWeight: "600",
    fontFamily: "system-ui, sans-serif",
    whiteSpace: "nowrap",
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
    pointerEvents: "none",
    zIndex: "15",
  });
  el.textContent = `${distance} nm · ${bearing}\u00B0`;
  return el;
}

// ─── Route Map View ───────────────────────────────────────

export default function RouteMapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapReady = useRef(false);
  const waypointMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const distanceLabelsRef = useRef<mapboxgl.Marker[]>([]);

  const {
    creationMode,
    draftWaypoints,
    passages,
    selectedPassageId,
    addWaypoint,
  } = useRouteStore();

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Refs for click handler (avoid stale closures)
  const creationModeRef = useRef(creationMode);
  creationModeRef.current = creationMode;
  const addWaypointRef = useRef(addWaypoint);
  addWaypointRef.current = addWaypoint;
  const draftWaypointsRef = useRef(draftWaypoints);
  draftWaypointsRef.current = draftWaypoints;

  // ─── Initialize Map ─────────────────────────────────────

  useEffect(() => {
    if (!mapContainer.current || !token) return;
    if (map.current) return;

    mapboxgl.accessToken = token;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-82.9, 42.5], // Detroit River / Lake St. Clair area
      zoom: 8,
      attributionControl: false,
    });

    map.current = mapInstance;

    mapInstance.addControl(
      new mapboxgl.NavigationControl({ showCompass: true }),
      "top-right"
    );

    // Click handler for waypoint placement
    mapInstance.on("click", (e) => {
      const mode = creationModeRef.current;
      if (mode === "idle") return;

      addWaypointRef.current({
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      });
    });

    mapInstance.on("load", () => {
      mapReady.current = true;
    });

    return () => {
      waypointMarkersRef.current.forEach((m) => m.remove());
      waypointMarkersRef.current = [];
      distanceLabelsRef.current.forEach((m) => m.remove());
      distanceLabelsRef.current = [];
      mapReady.current = false;
      mapInstance.remove();
      map.current = null;
    };
  }, [token]);

  // ─── Cursor Style Based on Mode ─────────────────────────

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.getCanvas().style.cursor =
      creationMode !== "idle" ? "crosshair" : "";
  }, [creationMode]);

  // ─── Draw Draft Route (waypoints being created/edited) ──

  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady.current) return;

    // Clear existing markers
    waypointMarkersRef.current.forEach((mk) => mk.remove());
    waypointMarkersRef.current = [];
    distanceLabelsRef.current.forEach((mk) => mk.remove());
    distanceLabelsRef.current = [];

    // Remove existing line layers
    if (m.getLayer("draft-route-line")) m.removeLayer("draft-route-line");
    if (m.getSource("draft-route")) m.removeSource("draft-route");

    if (draftWaypoints.length === 0) return;

    // Add numbered waypoint markers
    draftWaypoints.forEach((wp, i) => {
      const el = createWaypointMarkerElement(i, true);

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "bottom",
        draggable: true,
      })
        .setLngLat([wp.lng, wp.lat])
        .addTo(m);

      // Handle drag to reposition
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        useRouteStore.getState().updateWaypoint(i, {
          lat: lngLat.lat,
          lng: lngLat.lng,
        });
      });

      // Popup with name and coords
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: true,
      }).setHTML(
        `<div style="font-family:system-ui;padding:4px">
          <strong>${wp.name || `Waypoint ${i + 1}`}</strong><br/>
          <span style="font-size:11px;color:#666">${wp.lat.toFixed(4)}\u00B0N, ${Math.abs(wp.lng).toFixed(4)}\u00B0W</span>
        </div>`
      );
      marker.setPopup(popup);

      waypointMarkersRef.current.push(marker);
    });

    // Draw route line
    if (draftWaypoints.length >= 2) {
      const coordinates = draftWaypoints.map((wp) => [wp.lng, wp.lat]);

      m.addSource("draft-route", {
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
        id: "draft-route-line",
        type: "line",
        source: "draft-route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#0ea5e9",
          "line-width": 3.5,
          "line-opacity": 0.9,
          "line-dasharray": [2, 1],
        },
      });

      // Add distance/bearing labels at midpoints of each leg
      for (let i = 0; i < draftWaypoints.length - 1; i++) {
        const from = draftWaypoints[i];
        const to = draftWaypoints[i + 1];
        const distance = Math.round(computeTotalDistance([from, to]) * 10) / 10;
        const bearing = computeBearing(from.lat, from.lng, to.lat, to.lng);

        const midLat = (from.lat + to.lat) / 2;
        const midLng = (from.lng + to.lng) / 2;

        const labelEl = createDistanceLabel(distance, bearing);
        const labelMarker = new mapboxgl.Marker({
          element: labelEl,
          anchor: "center",
        })
          .setLngLat([midLng, midLat])
          .addTo(m);

        distanceLabelsRef.current.push(labelMarker);
      }
    }

    // Fit map to show all waypoints with padding
    if (draftWaypoints.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      draftWaypoints.forEach((wp) => bounds.extend([wp.lng, wp.lat]));
      m.fitBounds(bounds, {
        padding: { top: 60, bottom: 80, left: 40, right: 40 },
        maxZoom: 12,
        duration: 500,
      });
    } else if (draftWaypoints.length === 1) {
      m.flyTo({
        center: [draftWaypoints[0].lng, draftWaypoints[0].lat],
        zoom: 10,
        duration: 500,
      });
    }
  }, [draftWaypoints]);

  // ─── Draw Selected Passage Route (non-edit mode) ────────

  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady.current) return;

    // Don't draw passage route when in creation/edit mode
    if (creationMode !== "idle") return;

    // Clear previous passage display
    if (m.getLayer("passage-route-line")) m.removeLayer("passage-route-line");
    if (m.getSource("passage-route")) m.removeSource("passage-route");

    // Clear passage waypoint markers
    waypointMarkersRef.current.forEach((mk) => mk.remove());
    waypointMarkersRef.current = [];
    distanceLabelsRef.current.forEach((mk) => mk.remove());
    distanceLabelsRef.current = [];

    if (!selectedPassageId) return;

    const passage = passages.find((p) => p.id === selectedPassageId);
    if (!passage || !passage.waypoints || passage.waypoints.length < 2) return;

    const wps = passage.waypoints;

    // Add markers
    wps.forEach((wp, i) => {
      const el = createWaypointMarkerElement(i, false);
      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat([wp.lng, wp.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
            `<div style="font-family:system-ui;padding:4px">
              <strong>${wp.name || `Waypoint ${i + 1}`}</strong><br/>
              <span style="font-size:11px;color:#666">${wp.lat.toFixed(4)}\u00B0N, ${Math.abs(wp.lng).toFixed(4)}\u00B0W</span>
            </div>`
          )
        )
        .addTo(m);
      waypointMarkersRef.current.push(marker);
    });

    // Draw route line
    const coordinates = wps.map((wp) => [wp.lng, wp.lat]);
    m.addSource("passage-route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      },
    });

    m.addLayer({
      id: "passage-route-line",
      type: "line",
      source: "passage-route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#1B2A4A",
        "line-width": 3,
        "line-opacity": 0.7,
      },
    });

    // Fit bounds
    const bounds = new mapboxgl.LngLatBounds();
    wps.forEach((wp) => bounds.extend([wp.lng, wp.lat]));
    m.fitBounds(bounds, {
      padding: { top: 60, bottom: 80, left: 40, right: 40 },
      maxZoom: 11,
      duration: 800,
    });
  }, [selectedPassageId, passages, creationMode]);

  // ─── Creation Mode Banner ───────────────────────────────

  const totalDistance = computeTotalDistance(draftWaypoints);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-muted p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Map not configured. Add NEXT_PUBLIC_MAPBOX_TOKEN to enable.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Creation mode banner */}
      {creationMode !== "idle" && (
        <div className="absolute top-2 left-2 right-14 z-10 rounded-lg bg-ocean/90 px-3 py-2 text-white backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold">
                {creationMode === "creating" ? "Tap map to add waypoints" : "Editing route — tap to add, drag to move"}
              </p>
              <p className="text-[10px] text-white/70">
                {draftWaypoints.length} waypoint{draftWaypoints.length !== 1 ? "s" : ""}
                {totalDistance > 0 && ` · ${totalDistance} nm`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected route info (idle mode) */}
      {creationMode === "idle" && selectedPassageId && (
        <div className="absolute bottom-2 left-2 z-10 rounded-lg bg-card/90 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm">
          {(() => {
            const p = passages.find((r) => r.id === selectedPassageId);
            if (!p) return null;
            return (
              <>
                {p.name} · {p.rhumb_line_distance_nm || "?"} nm · {p.waypoints?.length || 0} waypoints
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
