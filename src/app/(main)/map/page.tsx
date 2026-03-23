import { Header, Wordmark } from "@/components/layout/header";

export default function MapPage() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <Header>
        <Wordmark />
      </Header>
      <div className="flex flex-1 items-center justify-center bg-navy-50 dark:bg-navy-900">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Map view coming in next session
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            NOAA charts + live buoy data + wind arrows
          </p>
        </div>
      </div>
    </div>
  );
}
