"use client";

import dynamic from "next/dynamic";
import { MapControls } from "@/components/map/map-controls";
import { BuoyPanel } from "@/components/map/buoy-panel";
import { Speedometer } from "@/components/map/speedometer";
import { TacticalAnalysis } from "@/components/map/tactical-analysis";
import { MapBottomDrawer } from "@/components/map/map-bottom-drawer";
import { RaceToolsFab } from "@/components/map/race-tools-fab";
import { WindShiftPanel } from "@/components/map/wind-shift-panel";
import { StartLineTool } from "@/components/map/start-line-tool";

// mapbox-gl accesses `window` at import time → must skip SSR
const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-navy-900">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ocean border-t-transparent" />
      </div>
    ),
  }
);

export default function MapPage() {
  return (
    <div className="relative" style={{ height: "calc(100dvh - var(--nav-total-height))" }}>
      {/* Base map */}
      <MapView />

      {/* Top-left utility controls: Layers / Reset / Refresh (3 buttons) */}
      <MapControls />

      {/* Buoy data popup when a station marker is tapped */}
      <BuoyPanel />

      {/* Always-on GPS speedometer (top-right or corner, no map interaction) */}
      <Speedometer />

      {/* AI tactical analysis panel (appears when course selected + button pressed) */}
      <TacticalAnalysis />

      {/* Unified bottom drawer — Courses | GPS Track | Race Timer tabs */}
      <MapBottomDrawer />

      {/* Race Tools FAB (bottom-right) — Wind Shift + Start Line Bias */}
      <RaceToolsFab />

      {/* Race tool bottom sheets — mutually exclusive, z-30, above drawer */}
      <WindShiftPanel />
      <StartLineTool />
    </div>
  );
}
