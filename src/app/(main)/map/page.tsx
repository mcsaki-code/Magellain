"use client";

import dynamic from "next/dynamic";
import { BuoyPanel } from "@/components/map/buoy-panel";
import { MapControls } from "@/components/map/map-controls";
import { Speedometer } from "@/components/map/speedometer";
import { CoursePanel } from "@/components/map/course-panel";
import { TacticalAnalysis } from "@/components/map/tactical-analysis";
import { GpsTracker } from "@/components/map/gps-tracker";
import { TrackReplay } from "@/components/map/track-replay";
import { RaceTimer } from "@/components/map/race-timer";
import { StartLineTool } from "@/components/map/start-line-tool";
import { WindShiftPanel } from "@/components/map/wind-shift-panel";
import { RaceChecklist } from "@/components/map/race-checklist";
import { RaceToolsFab } from "@/components/map/race-tools-fab";

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
      {/* Base map layer */}
      <MapView />

      {/* Utility controls — top-left (3 buttons: Layers, Reset, Refresh) */}
      <MapControls />

      {/* Persistent info panels */}
      <BuoyPanel />
      <Speedometer />
      <CoursePanel />
      <TacticalAnalysis />
      <GpsTracker />
      <TrackReplay />
      <RaceTimer />

      {/* Race Tools FAB — bottom-right floating action button */}
      <RaceToolsFab />

      {/* Mutually exclusive tool bottom sheets (z-30, rendered above everything) */}
      <WindShiftPanel />
      <StartLineTool />
      <RaceChecklist />
    </div>
  );
}
