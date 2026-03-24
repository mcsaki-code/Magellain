import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface RaceResultRow {
  boat_name: string;
  sail_number: string;
  fleet: string;
  corrected_position: number | null;
  status: string;
  elapsed_time_sec: number | null;
  corrected_time_sec: number | null;
}

interface StandingRow {
  place: number;
  boat_name: string;
  sail_number: string;
  total_points: number;
  races_sailed: number;
}

interface PerformanceRow {
  date: string;
  regatta: string;
  fleet: string;
  position: string;
  status: string;
  elapsed: string;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  // Navy blue header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, doc.internal.pageSize.width, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("MagellAIn", 14, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Sailing Intelligence", 14, 19);

  // Title below header
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 38);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(subtitle, 14, 45);
  }

  // Timestamp
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Generated ${now}`, doc.internal.pageSize.width - 14, 38, {
    align: "right",
  });
}

function addFooter(doc: jsPDF) {
  const pageCount = (doc as any).getNumberOfPages?.() ?? doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
    doc.text(
      "magellain.netlify.app",
      doc.internal.pageSize.width - 14,
      doc.internal.pageSize.height - 10,
      { align: "right" }
    );
  }
}

/**
 * Export race results for a single race as PDF
 */
export function exportRaceResultsPDF(
  regattaName: string,
  raceNumber: number,
  results: RaceResultRow[]
) {
  const doc = new jsPDF();
  addHeader(doc, `Race ${raceNumber} Results`, regattaName);

  // Group by fleet
  const fleets = Array.from(new Set(results.map((r) => r.fleet))).sort();

  let startY = 52;

  for (const fleet of fleets) {
    const fleetResults = results
      .filter((r) => r.fleet === fleet)
      .sort((a, b) => (a.corrected_position || 999) - (b.corrected_position || 999));

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(fleet, 14, startY);
    startY += 2;

    const hasTimingData = fleetResults.some((r) => r.elapsed_time_sec);

    const head = hasTimingData
      ? [["Pos", "Boat", "Sail #", "Elapsed", "Corrected", "Status"]]
      : [["Pos", "Boat", "Sail #", "Status"]];

    const body = fleetResults.map((r) => {
      const pos = r.status === "finished" ? String(r.corrected_position || "—") : "—";
      const base = [pos, r.boat_name, r.sail_number || "—"];
      if (hasTimingData) {
        base.push(
          r.elapsed_time_sec ? formatElapsed(r.elapsed_time_sec) : "—",
          r.corrected_time_sec ? formatElapsed(r.corrected_time_sec) : "—"
        );
      }
      base.push(r.status.toUpperCase());
      return base;
    });

    autoTable(doc, {
      startY,
      head,
      body,
      theme: "striped",
      headStyles: {
        fillColor: [30, 58, 138], // blue-900
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [241, 245, 249] }, // slate-100
      margin: { left: 14, right: 14 },
    });

    startY = (doc as any).lastAutoTable.finalY + 12;
  }

  addFooter(doc);
  doc.save(`${regattaName.replace(/\s+/g, "_")}_Race${raceNumber}.pdf`);
}

/**
 * Export series standings as PDF
 */
export function exportSeriesStandingsPDF(
  regattaName: string,
  standingsByFleet: Record<string, StandingRow[]>
) {
  const doc = new jsPDF();
  addHeader(doc, "Series Standings", regattaName);

  const fleets = Object.keys(standingsByFleet).sort();
  let startY = 52;

  for (const fleet of fleets) {
    const standings = standingsByFleet[fleet];

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(fleet, 14, startY);
    startY += 2;

    autoTable(doc, {
      startY,
      head: [["Place", "Boat", "Sail #", "Points", "Races"]],
      body: standings.map((s) => [
        String(s.place),
        s.boat_name,
        s.sail_number || "—",
        String(s.total_points),
        String(s.races_sailed),
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [30, 58, 138],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: 14, right: 14 },
    });

    startY = (doc as any).lastAutoTable.finalY + 12;
  }

  addFooter(doc);
  doc.save(`${regattaName.replace(/\s+/g, "_")}_Standings.pdf`);
}

/**
 * Export boat performance dashboard as PDF
 */
export function exportPerformancePDF(
  boatName: string,
  sailNumber: string,
  stats: {
    totalRaces: number;
    wins: number;
    podiums: number;
    avgPosition: string;
  },
  raceLog: PerformanceRow[],
  competitors?: Array<{
    boat_name: string;
    sail_number: string;
    shared_events: number;
    wins: number;
    losses: number;
  }>
) {
  const doc = new jsPDF();
  addHeader(doc, `${boatName} Performance`, sailNumber ? `Sail #${sailNumber}` : undefined);

  // Stats summary
  let y = 52;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);

  const statsLine = [
    `Races: ${stats.totalRaces}`,
    `Wins: ${stats.wins}`,
    `Podiums: ${stats.podiums}`,
    `Avg Position: ${stats.avgPosition}`,
  ].join("   |   ");
  doc.text(statsLine, 14, y);
  y += 10;

  // Race log table
  doc.setFontSize(11);
  doc.text("Race Log", 14, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["Date", "Regatta", "Fleet", "Position", "Status", "Elapsed"]],
    body: raceLog.map((r) => [
      r.date,
      r.regatta,
      r.fleet,
      r.position,
      r.status.toUpperCase(),
      r.elapsed,
    ]),
    theme: "striped",
    headStyles: {
      fillColor: [30, 58, 138],
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { left: 14, right: 14 },
    columnStyles: {
      1: { cellWidth: 50 }, // Regatta name gets more space
    },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // Competitors table
  if (competitors && competitors.length > 0) {
    // Check if we need a new page
    if (y > doc.internal.pageSize.height - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Head-to-Head vs Competitors", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Competitor", "Sail #", "Shared Races", "Wins", "Losses", "Win %"]],
      body: competitors.slice(0, 15).map((c) => {
        const total = c.wins + c.losses;
        const winPct = total > 0 ? `${Math.round((c.wins / total) * 100)}%` : "—";
        return [
          c.boat_name,
          c.sail_number || "—",
          String(c.shared_events),
          String(c.wins),
          String(c.losses),
          winPct,
        ];
      }),
      theme: "striped",
      headStyles: {
        fillColor: [30, 58, 138],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  doc.save(`${boatName.replace(/\s+/g, "_")}_Performance.pdf`);
}
