import { Header } from "@/components/layout/header";

export default function WeatherPage() {
  return (
    <div className="flex flex-col">
      <Header title="Weather" />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Weather dashboard coming in next session
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Wind, waves, forecasts, and alerts
          </p>
        </div>
      </div>
    </div>
  );
}
