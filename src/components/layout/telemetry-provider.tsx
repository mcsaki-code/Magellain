"use client";

import { usePageTrack } from "@/lib/telemetry/use-page-track";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  usePageTrack();
  return <>{children}</>;
}
