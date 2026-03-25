import { NextResponse } from "next/server";

export interface WindHistoryPoint {
  timestamp: number; // Unix ms
  wind_dir: number;
  wind_speed: number;
}

/**
 * Fetches the last ~90 minutes of wind observations from an NDBC station.
 * NDBC realtime2 format: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE
 * Column indices:        0  1  2  3  4  5    6    7  ...
 */
export async function GET(
  _req: Request,
  { params }: { params: { stationId: string } }
) {
  const { stationId } = params;

  // Validate station ID — alphanumeric only, max 10 chars
  if (!/^[A-Z0-9]{1,10}$/i.test(stationId)) {
    return NextResponse.json({ error: "Invalid station ID" }, { status: 400 });
  }

  const url = `https://www.ndbc.noaa.gov/data/realtime2/${stationId.toUpperCase()}.txt`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MagellAIn/1.4 (sailing intelligence app)" },
      next: { revalidate: 300 }, // cache 5 min
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `NDBC returned ${res.status}` },
        { status: 502 }
      );
    }

    const text = await res.text();
    const lines = text.trim().split("\n");

    // Skip header lines (start with #)
    const dataLines = lines.filter((l) => !l.startsWith("#"));

    // Parse up to 18 rows (30-min intervals → ~90 min; some stations report every 10 min → 9 rows)
    const maxRows = 18;
    const points: WindHistoryPoint[] = [];
    const now = Date.now();
    const cutoffMs = now - 90 * 60 * 1000; // 90 minutes ago

    for (let i = 0; i < Math.min(dataLines.length, maxRows); i++) {
      const parts = dataLines[i].trim().split(/\s+/);
      if (parts.length < 7) continue;

      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      const hour = parseInt(parts[3]);
      const minute = parseInt(parts[4]);
      const windDir = parts[5] === "MM" ? null : parseFloat(parts[5]);
      const windSpeed = parts[6] === "MM" ? null : parseFloat(parts[6]);

      if (windDir === null || windSpeed === null) continue;
      if (isNaN(windDir) || isNaN(windSpeed)) continue;

      const ts = Date.UTC(year < 100 ? 2000 + year : year, month, day, hour, minute, 0);
      if (ts < cutoffMs) break; // Stop once we're beyond the 90-min window

      points.push({ timestamp: ts, wind_dir: windDir, wind_speed: windSpeed });
    }

    // Return oldest → newest for charting
    points.reverse();

    return NextResponse.json({ stationId, points });
  } catch (err) {
    console.error("[wind-history] fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch NDBC data" }, { status: 500 });
  }
}
