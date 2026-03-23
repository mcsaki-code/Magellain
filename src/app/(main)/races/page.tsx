import { Header } from "@/components/layout/header";

export default function RacesPage() {
  return (
    <div className="flex flex-col">
      <Header title="Races" />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Race schedule coming in a future session
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            FYC and WSSC calendars, results, and standings
          </p>
        </div>
      </div>
    </div>
  );
}
