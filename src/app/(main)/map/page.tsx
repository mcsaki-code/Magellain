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
      <MapView />
      <MapControls />
      <BuoyPanel />
      <Speedometer />
      <CoursePanel />
      <TacticalAnalysis />
      <GpsTracker />
      <TrackReplay />
      <RaceTimer />
      <StartLineTool />
      <WindShiftPanel />
      <RaceChecklist />
    </div>
  );
}
