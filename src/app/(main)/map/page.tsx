"use client";

import { MapView } from "@/components/map/map-view";
import { BuoyPanel } from "@/components/map/buoy-panel";
import { MapControls } from "@/components/map/map-controls";
import { Speedometer } from "@/components/map/speedometer";

export default function MapPage() {
  return (
    <div className="relative h-[calc(100dvh-4rem)]">
      <MapView />
      <MapControls />
      <BuoyPanel />
      <Speedometer />
    </div>
  );
}
