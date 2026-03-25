"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import type { Regatta, Race, Boat, RaceResult } from "@/lib/types";
import {
  ChevronLeft,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────

interface ParsedRow {
  [key: string]: string;
}

interface ColumnMapping {
  [csvColumn: string]: string; // maps to: boat_name, sail_number, fleet, finish_position, corrected_position, elapsed_time, corrected_time, status, ignore
}

interface PreviewRow {
  boat_name: string | null;
  sail_number: string | null;
  fleet: string | null;
  finish_position: number | null;
  corrected_position: number | null;
  elapsed_time_sec: number | null;
  corrected_time_sec: number | null;
  status: string | null;
  warnings: string[];
}

// ─── CSV Parser ──────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: ParsedRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// ─── Smart Column Mapping ──────────────────────────────────────────

function smartMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const patterns = {
    boat_name: ["boat", "name", "boat_name"],
    sail_number: ["sail", "sail_number", "number"],
    fleet: ["fleet", "class"],
    finish_position: ["finish", "position", "finish_position", "fp"],
    corrected_position: ["corrected", "corrected_position", "cp"],
    elapsed_time: ["elapsed", "time", "elapsed_time"],
    corrected_time: ["corrected_time", "ct"],
    status: ["status", "result"],
  };

  for (const header of headers) {
    const lower = header.toLowerCase();
    let matched = false;

    for (const [field, patterns_list] of Object.entries(patterns)) {
      for (const pattern of patterns_list) {
        if (lower.includes(pattern)) {
          mapping[header] = field;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      mapping[header] = "ignore";
    }
  }

  return mapping;
}

// ─── Time Conversion ──────────────────────────────────────────────────

function parseTime(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;

  const parts = timeStr.trim().split(":").map((p) => parseInt(p, 10));
  let seconds = 0;

  if (parts.length === 3) {
    // HH:MM:SS
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    seconds = parts[0] * 60 + parts[1];
  } else {
    return null;
  }

  return isNaN(seconds) ? null : seconds;
}

// ─── Template Download ──────────────────────────────────────────────

function downloadTemplate() {
  const headers = [
    "boat_name",
    "sail_number",
    "fleet",
    "finish_position",
    "corrected_position",
    "elapsed_time",
    "corrected_time",
    "status",
  ];
  const exampleRows = [
    [
      "Impetuous",
      "99999",
      "Cruising",
      "1",
      "1",
      "01:23:45",
      "01:15:30",
      "finished",
    ],
    [
      "Wandering",
      "88888",
      "Cruising",
      "2",
      "2",
      "01:25:00",
      "01:17:15",
      "finished",
    ],
    [
      "Ghost",
      "77777",
      "Cruising",
      "",
      "",
      "",
      "",
      "dnf",
    ],
  ];

  const csv =
    [headers, ...exampleRows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n") + "\n";

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "race_results_template.csv";
  link.click();
}

// ─── Main Component ──────────────────────────────────────────────────

export default function RacesImportPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvData, setCSVData] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const [selectedRegattaId, setSelectedRegattaId] = useState<string>("");
  const [selectedRaceNumber, setSelectedRaceNumber] = useState<number | "new">(1);
  const [newRaceDate, setNewRaceDate] = useState<string>("");
  const [newRaceTime, setNewRaceTime] = useState<string>("10:00");
  const [newRaceCourseType, setNewRaceCourseType] = useState<string>("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);
  const [raceNumbers, setRaceNumbers] = useState<number[]>([]);

  // ─── Step 1: Upload CSV ──────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setCSVData(parsed);

      // Smart map columns
      const mapping = smartMapColumns(parsed.headers);
      setColumnMapping(mapping);

      // Move to step 2
      setStep(2);
    };
    reader.readAsText(file);
  };

  // ─── Step 2: Column Mapping ─────────────────────────────────────

  const handleMappingChange = (csvColumn: string, field: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [csvColumn]: field,
    }));
  };

  const handleNextFromMapping = async () => {
    // Fetch regattas
    const supabase = createClient();
    const { data } = await supabase
      .from("regattas")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: false });

    if (data) {
      setRegattas(data);
      if (data.length > 0) {
        setSelectedRegattaId(data[0].id);
        // Load race numbers for first regatta
        await loadRaceNumbers(data[0].id);
      }
    }

    setStep(3);
  };

  const loadRaceNumbers = async (regattaId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("races")
      .select("race_number")
      .eq("regatta_id", regattaId)
      .order("race_number", { ascending: true });

    if (data) {
      const numbers = data.map((r) => r.race_number);
      setRaceNumbers(numbers);
      setSelectedRaceNumber("new");
    }
  };

  const handleRegattaChange = async (regattaId: string) => {
    setSelectedRegattaId(regattaId);
    await loadRaceNumbers(regattaId);
    setSelectedRaceNumber("new");
  };

  // ─── Step 3 & 4: Preview & Import ───────────────────────────────

  const handleNextFromSelect = async () => {
    if (!csvData) return;

    // Generate preview rows
    const previews: PreviewRow[] = csvData.rows.map((row) => {
      const preview: PreviewRow = {
        boat_name: null,
        sail_number: null,
        fleet: null,
        finish_position: null,
        corrected_position: null,
        elapsed_time_sec: null,
        corrected_time_sec: null,
        status: null,
        warnings: [],
      };

      for (const [csvCol, field] of Object.entries(columnMapping)) {
        const value = row[csvCol];
        if (!value || field === "ignore") continue;

        switch (field) {
          case "boat_name":
            preview.boat_name = value;
            break;
          case "sail_number":
            preview.sail_number = value;
            break;
          case "fleet":
            preview.fleet = value;
            break;
          case "finish_position":
            preview.finish_position = parseInt(value, 10) || null;
            break;
          case "corrected_position":
            preview.corrected_position = parseInt(value, 10) || null;
            break;
          case "elapsed_time":
            preview.elapsed_time_sec = parseTime(value);
            break;
          case "corrected_time":
            preview.corrected_time_sec = parseTime(value);
            break;
          case "status":
            preview.status = value.toLowerCase();
            break;
        }
      }

      // Validation
      if (!preview.boat_name) preview.warnings.push("Missing boat name");
      if (!preview.fleet) preview.warnings.push("Missing fleet");
      if (
        preview.status &&
        ![
          "finished",
          "dnf",
          "dns",
          "dnc",
          "dsq",
          "ocs",
          "raf",
          "ufd",
          "rdg",
          "rc",
          "tle",
        ].includes(preview.status)
      ) {
        preview.warnings.push(`Invalid status: ${preview.status}`);
      }

      return preview;
    });

    setPreviewRows(previews);
    setStep(4);
  };

  const handleImport = async () => {
    if (!csvData || !selectedRegattaId) return;

    setIsImporting(true);
    try {
      const supabase = createClient();

      // Find or create race
      let raceId: string | null = null;

      if (selectedRaceNumber === "new") {
        // Create new race
        const regatta = regattas.find((r) => r.id === selectedRegattaId);
        const nextRaceNumber = Math.max(...raceNumbers, 0) + 1;

        const scheduledStart = newRaceDate
          ? new Date(`${newRaceDate}T${newRaceTime}`).toISOString()
          : new Date().toISOString();

        const { data: newRace, error: raceError } = await supabase
          .from("races")
          .insert([
            {
              regatta_id: selectedRegattaId,
              race_number: nextRaceNumber,
              scheduled_start: scheduledStart,
              course_type: newRaceCourseType || null,
              status: "completed",
            },
          ])
          .select("id");

        if (raceError) throw raceError;
        raceId = newRace?.[0]?.id;
      } else {
        // Find existing race
        const { data } = await supabase
          .from("races")
          .select("id")
          .eq("regatta_id", selectedRegattaId)
          .eq("race_number", selectedRaceNumber)
          .single();

        raceId = data?.id || null;
      }

      if (!raceId) throw new Error("Failed to create or find race");

      // Upsert boats and collect boat_ids
      const boatMap = new Map<string, string>();

      for (const row of previewRows) {
        if (!row.sail_number) continue;

        const { data: existingBoat } = await supabase
          .from("boats")
          .select("id")
          .eq("sail_number", row.sail_number)
          .single();

        if (existingBoat) {
          boatMap.set(row.sail_number, existingBoat.id);
        } else {
          const { data: newBoat, error: boatError } = await supabase
            .from("boats")
            .insert([
              {
                name: row.boat_name || "Unknown",
                sail_number: row.sail_number,
                class_name: row.fleet || "Unknown",
                hull_type: "monohull",
                owner_id: (await supabase.auth.getUser()).data.user?.id,
              },
            ])
            .select("id");

          if (boatError) throw boatError;
          boatMap.set(row.sail_number, newBoat?.[0]?.id);
        }
      }

      // Insert race results
      const results: Partial<RaceResult>[] = previewRows
        .filter((row) => row.sail_number && boatMap.has(row.sail_number))
        .map((row) => ({
          race_id: raceId,
          boat_id: boatMap.get(row.sail_number ?? "") ?? undefined,
          fleet: row.fleet || "Unknown",
          finish_position: row.finish_position,
          corrected_position: row.corrected_position,
          elapsed_time_sec: row.elapsed_time_sec,
          corrected_time_sec: row.corrected_time_sec,
          status: (row.status || "finished") as RaceResult["status"],
        }));

      if (results.length > 0) {
        const { error: resultsError } = await supabase
          .from("race_results")
          .insert(results);

        if (resultsError) throw resultsError;
      }

      setImportResult({
        success: true,
        message: `Successfully imported ${results.length} race results`,
        count: results.length,
      });
    } catch (err) {
      console.error("Import error:", err);
      setImportResult({
        success: false,
        message: `Import failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Import Race Results" />

      <div className="space-y-4 p-4">
        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex items-center gap-2 ${s !== 4 ? "flex-1" : ""}`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  s === step
                    ? "bg-ocean text-white"
                    : s < step
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? "✓" : s}
              </div>
              {s !== 4 && (
                <div
                  className={`flex-1 h-0.5 ${
                    s < step ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload CSV */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Upload Race Results CSV</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a CSV file with race results
              </p>
            </div>

            {/* Dropzone */}
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 transition-colors hover:border-ocean/50 hover:bg-ocean/5">
              <Upload className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium">Click to upload CSV</p>
              <p className="text-xs text-muted-foreground">or drag and drop</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {/* Example Format */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Example CSV Format:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left">boat_name</th>
                      <th className="px-2 py-1 text-left">sail_number</th>
                      <th className="px-2 py-1 text-left">fleet</th>
                      <th className="px-2 py-1 text-left">finish_position</th>
                      <th className="px-2 py-1 text-left">corrected_position</th>
                      <th className="px-2 py-1 text-left">elapsed_time</th>
                      <th className="px-2 py-1 text-left">corrected_time</th>
                      <th className="px-2 py-1 text-left">status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1">Impetuous</td>
                      <td className="px-2 py-1">99999</td>
                      <td className="px-2 py-1">Cruising</td>
                      <td className="px-2 py-1">1</td>
                      <td className="px-2 py-1">1</td>
                      <td className="px-2 py-1">01:23:45</td>
                      <td className="px-2 py-1">01:15:30</td>
                      <td className="px-2 py-1">finished</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Status values: finished, dnf, dns, dnc, dsq, ocs, raf, ufd, rdg, rc, tle
              </p>
            </div>

            {/* Download Template Button */}
            <button
              onClick={downloadTemplate}
              className="flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted dark:bg-card"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && csvData && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Map Columns</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Match CSV columns to race result fields
              </p>
            </div>

            {/* Mapping Table */}
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-semibold">
                      CSV Column
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">Map To</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.headers.map((header) => (
                    <tr key={header} className="border-b">
                      <td className="px-3 py-2 text-xs font-medium">
                        {header}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={columnMapping[header] || "ignore"}
                          onChange={(e) =>
                            handleMappingChange(header, e.target.value)
                          }
                          className="rounded border bg-card px-2 py-1 text-xs"
                        >
                          <option value="ignore">— Ignore —</option>
                          <option value="boat_name">boat_name</option>
                          <option value="sail_number">sail_number</option>
                          <option value="fleet">fleet</option>
                          <option value="finish_position">
                            finish_position
                          </option>
                          <option value="corrected_position">
                            corrected_position
                          </option>
                          <option value="elapsed_time">elapsed_time</option>
                          <option value="corrected_time">corrected_time</option>
                          <option value="status">status</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Preview */}
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Preview (first 3 rows):
              </p>
              <div className="overflow-x-auto rounded-lg border bg-muted/20 p-3">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b">
                      {csvData.headers.map((h) => (
                        <th key={h} className="px-1 py-1 text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 3).map((row, idx) => (
                      <tr key={idx} className="border-b">
                        {csvData.headers.map((h) => (
                          <td key={h} className="px-1 py-1 text-muted-foreground">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleNextFromMapping}
                className="flex-1 rounded-lg bg-ocean px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ocean/90"
              >
                Next: Select Race
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Select Race */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Select Race</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a regatta and race for these results
              </p>
            </div>

            {/* Regatta Selection */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Regatta
              </label>
              <select
                value={selectedRegattaId}
                onChange={(e) => handleRegattaChange(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm"
              >
                {regattas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Race Selection */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Race
              </label>
              <select
                value={selectedRaceNumber}
                onChange={(e) =>
                  setSelectedRaceNumber(
                    e.target.value === "new" ? "new" : parseInt(e.target.value, 10)
                  )
                }
                className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <option value="new">+ Create New Race</option>
                {raceNumbers.map((num) => (
                  <option key={num} value={num}>
                    Race {num}
                  </option>
                ))}
              </select>
            </div>

            {/* New Race Fields */}
            {selectedRaceNumber === "new" && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  New Race Details
                </p>
                <div>
                  <label className="text-xs font-medium">Date</label>
                  <input
                    type="date"
                    value={newRaceDate}
                    onChange={(e) => setNewRaceDate(e.target.value)}
                    className="mt-1 w-full rounded border bg-card px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Start Time</label>
                  <input
                    type="time"
                    value={newRaceTime}
                    onChange={(e) => setNewRaceTime(e.target.value)}
                    className="mt-1 w-full rounded border bg-card px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Course Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Course A, Triangle"
                    value={newRaceCourseType}
                    onChange={(e) => setNewRaceCourseType(e.target.value)}
                    className="mt-1 w-full rounded border bg-card px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleNextFromSelect}
                className="flex-1 rounded-lg bg-ocean px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ocean/90"
              >
                Next: Preview & Confirm
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview & Confirm */}
        {step === 4 && !importResult && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Preview Results</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review the data before importing
              </p>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-2 py-2 text-left font-semibold">Boat</th>
                    <th className="px-2 py-2 text-left font-semibold">Sail</th>
                    <th className="px-2 py-2 text-left font-semibold">Fleet</th>
                    <th className="px-2 py-2 text-center font-semibold">Fin</th>
                    <th className="px-2 py-2 text-center font-semibold">Corr</th>
                    <th className="px-2 py-2 text-left font-semibold">Status</th>
                    <th className="px-2 py-2 text-left font-semibold">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-b ${
                        row.warnings.length > 0
                          ? "bg-yellow-50 dark:bg-yellow-950/20"
                          : ""
                      }`}
                    >
                      <td className="px-2 py-2 font-medium">{row.boat_name}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {row.sail_number}
                      </td>
                      <td className="px-2 py-2">{row.fleet}</td>
                      <td className="px-2 py-2 text-center">
                        {row.finish_position ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {row.corrected_position ?? "—"}
                      </td>
                      <td className="px-2 py-2">{row.status}</td>
                      <td className="px-2 py-2">
                        {row.warnings.length > 0 && (
                          <div className="flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                            <span className="text-[9px] text-yellow-700 dark:text-yellow-400">
                              {row.warnings.join(", ")}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Import Button */}
            <div className="flex gap-2">
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-ocean px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ocean/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${previewRows.length} Results`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Success/Error Result */}
        {importResult && (
          <div className="space-y-4">
            <div
              className={`flex gap-3 rounded-lg border p-4 ${
                importResult.success
                  ? "border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-950/20"
                  : "border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20"
              }`}
            >
              {importResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`font-semibold ${
                    importResult.success
                      ? "text-green-900 dark:text-green-200"
                      : "text-red-900 dark:text-red-200"
                  }`}
                >
                  {importResult.message}
                </p>
              </div>
            </div>

            {/* Back to Races Link */}
            <Link
              href="/races"
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Back to Races
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
