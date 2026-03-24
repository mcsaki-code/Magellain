"use client";

import dynamic from "next/dynamic";
import { BuoyPanel } from "@/components/map/buoy-panel";
import { MapControls } from "@/components/map/map-controls";
import { Speedometer } from "@/components/map/speedometer";
import { CoursePanel } from "@/components/map/course-panel";
import { TacticalAnalysis } from "@/components/map/tactical-analysis";

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
    <div className="relative h-[calc(100dvh-4rem)]">
      <MapView />
      <MapControls />
      <BuoyPanel />
      <Speedometer />
      <CoursePanel />
      <TacticalAnalysis />
    </div>
  );
}
