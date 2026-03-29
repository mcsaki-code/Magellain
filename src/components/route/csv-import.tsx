"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, AlertCircle, CheckCircle2, X, MapPin,
  Trash2, ArrowRight, Loader2, Table2, Eye
} from "lucide-react";
import { useRouteStore, computeTotalDistance, type Waypoint } from "@/lib/store/route-store";
import { trackEvent } from "@/lib/telemetry/tracker";

// ─── CSV Parsing ──────────────────────────────────────────

interface ParseResult {
  waypoints: Waypoint[];
  errors: string[];
  warnings: string[];
}

function parseCSV(text: string): ParseResult {
  const waypoints: Waypoint[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Strip BOM
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) {
    errors.push("File is empty");
    return { waypoints, errors, warnings };
  }

  // Split lines, detect delimiter
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    errors.push("File must have a header row and at least one data row");
    return { waypoints, errors, warnings };
  }

  // Detect delimiter: tab, comma, semicolon
  const headerLine = lines[0];
  let delimiter = ",";
  if (headerLine.includes("\t") && !headerLine.includes(",")) delimiter = "\t";
  else if (headerLine.includes(";") && !headerLine.includes(",")) delimiter = ";";

  // Parse header — find lat, lng, name, notes columns
  const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));

  const latIdx = headers.findIndex((h) =>
    ["lat", "latitude", "lat_deg", "y"].includes(h)
  );
  const lngIdx = headers.findIndex((h) =>
    ["lng", "lon", "long", "longitude", "lng_deg", "lon_deg", "x"].includes(h)
  );
  const nameIdx = headers.findIndex((h) =>
    ["name", "waypoint", "mark", "label", "title", "point"].includes(h)
  );
  const notesIdx = headers.findIndex((h) =>
    ["notes", "note", "description", "desc", "comment", "comments"].includes(h)
  );

  if (latIdx === -1 || lngIdx === -1) {
    errors.push(
      `Could not find latitude/longitude columns. Found headers: ${headers.join(", ")}. Expected columns named "lat"/"latitude" and "lng"/"longitude".`
    );
    return { waypoints, errors, warnings };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));

    const latStr = cols[latIdx];
    const lngStr = cols[lngIdx];

    if (!latStr || !lngStr) {
      warnings.push(`Row ${i + 1}: Missing lat/lng, skipped`);
      continue;
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      warnings.push(`Row ${i + 1}: Invalid coordinates "${latStr}, ${lngStr}", skipped`);
      continue;
    }

    // Validate Great Lakes region (loose bounds)
    if (lat < 40 || lat > 50 || lng < -95 || lng > -74) {
      warnings.push(`Row ${i + 1}: Coordinates (${lat}, ${lng}) outside Great Lakes region, included anyway`);
    }

    const name = nameIdx >= 0 && cols[nameIdx] ? cols[nameIdx] : `Mark ${waypoints.length + 1}`;
    const notes = notesIdx >= 0 && cols[notesIdx] ? cols[notesIdx] : null;

    waypoints.push({
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
      name,
      notes,
    });
  }

  if (waypoints.length === 0) {
    errors.push("No valid waypoints found in file");
  } else if (waypoints.length < 2) {
    errors.push("Need at least 2 waypoints to create a route");
  }

  return { waypoints, errors, warnings };
}

// ─── Waypoint Preview Row ─────────────────────────────────

function PreviewRow({ wp, index, onRemove }: { wp: Waypoint; index: number; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card p-2 group">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ocean text-[9px] font-bold text-white">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{wp.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground/0 group-hover:text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── CSV Import Component ─────────────────────────────────

export default function CSVImport() {
  const { addWaypoint, setDraftName, startCreating, cancelCreation } = useRouteStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [parsedWaypoints, setParsedWaypoints] = useState<Waypoint[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCSV(text);

      setParsedWaypoints(result.waypoints);
      setParseErrors(result.errors);
      setParseWarnings(result.warnings);

      if (result.waypoints.length >= 2) {
        setStep("preview");
      }
    };
    reader.readAsText(file);

    trackEvent("csv_import_started", { fileName: file.name });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".csv") || file.name.endsWith(".tsv") || file.name.endsWith(".txt"))) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleImport = useCallback(() => {
    if (parsedWaypoints.length < 2) return;
    setImporting(true);

    // Enter creation mode with the parsed waypoints
    startCreating();

    // Set route name from filename
    const baseName = fileName.replace(/\.(csv|tsv|txt)$/i, "").replace(/[_-]/g, " ");
    setDraftName(baseName);

    // Add all waypoints
    parsedWaypoints.forEach((wp) => addWaypoint(wp));

    trackEvent("csv_import_completed", {
      fileName,
      waypointCount: parsedWaypoints.length,
      distance: computeTotalDistance(parsedWaypoints),
    });

    setStep("done");
    setImporting(false);
  }, [parsedWaypoints, fileName, startCreating, setDraftName, addWaypoint]);

  const removeWaypoint = useCallback((index: number) => {
    setParsedWaypoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const reset = useCallback(() => {
    setStep("upload");
    setParsedWaypoints([]);
    setParseErrors([]);
    setParseWarnings([]);
    setFileName("");
  }, []);

  // ─── Upload Step ──────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ocean/30 bg-ocean/5 p-6 text-center transition-colors hover:border-ocean/50 hover:bg-ocean/10"
        >
          <Upload className="h-8 w-8 text-ocean/50" />
          <p className="text-xs font-medium text-foreground">
            Drop a CSV file here or tap to browse
          </p>
          <p className="text-[10px] text-muted-foreground">
            Columns: name, latitude, longitude (and optionally notes)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Sample format */}
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Table2 className="h-3.5 w-3.5 text-ocean" />
            <p className="text-xs font-semibold">Expected CSV Format</p>
          </div>
          <pre className="rounded-md bg-muted/50 p-2 text-[10px] font-mono text-muted-foreground overflow-x-auto">
{`name,latitude,longitude,notes
Start Mark,42.3478,-82.9789,Port Huron
Turn 1,43.0123,-82.4567,Outer buoy
Finish,43.7890,-82.1234,Mackinac`}
          </pre>
        </div>

        {/* Errors from previous attempt */}
        {parseErrors.length > 0 && (
          <div className="space-y-1">
            {parseErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Preview Step ─────────────────────────────────────
  if (step === "preview") {
    const totalDist = computeTotalDistance(parsedWaypoints);

    return (
      <div className="space-y-3">
        {/* File info */}
        <div className="flex items-center gap-2 rounded-lg border border-ocean/20 bg-ocean/5 p-2.5">
          <FileText className="h-4 w-4 text-ocean shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{fileName}</p>
            <p className="text-[10px] text-muted-foreground">
              {parsedWaypoints.length} waypoints · {totalDist} nm total
            </p>
          </div>
          <button onClick={reset} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Warnings */}
        {parseWarnings.length > 0 && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2.5">
            <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">
              {parseWarnings.length} warning{parseWarnings.length !== 1 ? "s" : ""}
            </p>
            {parseWarnings.slice(0, 3).map((w, i) => (
              <p key={i} className="text-[10px] text-muted-foreground">{w}</p>
            ))}
            {parseWarnings.length > 3 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                +{parseWarnings.length - 3} more
              </p>
            )}
          </div>
        )}

        {/* Waypoint preview list */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Waypoints Preview
            </p>
            <p className="text-[10px] text-ocean font-medium">{totalDist} nm</p>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {parsedWaypoints.map((wp, i) => (
              <PreviewRow
                key={`${i}-${wp.lat}-${wp.lng}`}
                wp={wp}
                index={i}
                onRemove={() => removeWaypoint(i)}
              />
            ))}
          </div>
        </div>

        {/* Import button */}
        <div className="space-y-2">
          <button
            onClick={handleImport}
            disabled={importing || parsedWaypoints.length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean px-4 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Import to Route Creator
              </>
            )}
          </button>
          <button
            onClick={reset}
            className="flex w-full items-center justify-center rounded-xl border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Choose Different File
          </button>
        </div>
      </div>
    );
  }

  // ─── Done Step ────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <CheckCircle2 className="h-8 w-8 text-green-500" />
      <p className="text-sm font-semibold">Waypoints Imported</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        {parsedWaypoints.length} waypoints loaded into the route creator. Review and save your route.
      </p>
    </div>
  );
}
