"use client";

import { useState } from "react";
import {
  MapPin,
  Plus,
  Trash2,
  GripVertical,
  Navigation,
  Save,
  X,
  Keyboard,
  Map,
  ChevronDown,
  ChevronUp,
  Globe,
  AlertCircle,
} from "lucide-react";
import { useRouteStore, computeTotalDistance, computeBearing, type Waypoint } from "@/lib/store/route-store";

// ─── DMS Parser ───────────────────────────────────────────

function parseDMS(input: string): number | null {
  // Try decimal first
  const decimal = parseFloat(input);
  if (!isNaN(decimal) && input.match(/^-?\d+\.?\d*$/)) return decimal;

  // Try DMS: 42°20'44"N or 42 20 44 N
  const dmsRegex = /(-?\d+)[°\s]+(\d+)['\s]+(\d+\.?\d*)["\s]*([NSEWnsew])?/;
  const match = input.match(dmsRegex);
  if (match) {
    const deg = parseInt(match[1]);
    const min = parseInt(match[2]);
    const sec = parseFloat(match[3]);
    const dir = match[4]?.toUpperCase();
    let result = Math.abs(deg) + min / 60 + sec / 3600;
    if (dir === "S" || dir === "W" || deg < 0) result = -result;
    return result;
  }

  return null;
}

function formatCoord(value: number, isLat: boolean): string {
  const dir = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  return `${deg}\u00B0${min}'${sec}"${dir}`;
}

// ─── Manual Coordinate Input ──────────────────────────────

function ManualCoordInput({ onAdd }: { onAdd: (wp: Waypoint) => void }) {
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState("");

  const handleAdd = () => {
    setError("");
    const lat = parseDMS(latInput);
    const lng = parseDMS(lngInput);

    if (lat === null || lng === null) {
      setError("Invalid coordinates. Use decimal (42.3456) or DMS (42\u00B020'44\"N)");
      return;
    }

    // Validate Great Lakes bounds
    if (lat < 41 || lat > 49 || lng < -93 || lng > -76) {
      setError("Coordinates must be within the Great Lakes region");
      return;
    }

    onAdd({ lat, lng, name: nameInput.trim() || undefined });
    setLatInput("");
    setLngInput("");
    setNameInput("");
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-ocean/30 bg-ocean/5 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-ocean">
        <Keyboard className="h-3.5 w-3.5" />
        Manual Entry
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Latitude (42.3456 or 42°20'44&quot;N)"
          value={latInput}
          onChange={(e) => setLatInput(e.target.value)}
          className="rounded-md border bg-background px-2.5 py-2 text-xs placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean/30"
        />
        <input
          type="text"
          placeholder="Longitude (-83.12 or 83°07'24&quot;W)"
          value={lngInput}
          onChange={(e) => setLngInput(e.target.value)}
          className="rounded-md border bg-background px-2.5 py-2 text-xs placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean/30"
        />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Waypoint name (optional)"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="flex-1 rounded-md border bg-background px-2.5 py-2 text-xs placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean/30"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 rounded-md bg-ocean px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-ocean/90 active:scale-[0.97]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Waypoint List Item ───────────────────────────────────

function WaypointItem({
  wp,
  index,
  total,
  nextWp,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  wp: Waypoint;
  index: number;
  total: number;
  nextWp: Waypoint | null;
  onUpdate: (updates: Partial<Waypoint>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(wp.name || "");

  const legDistance =
    nextWp ? (Math.round(computeTotalDistance([wp, nextWp]) * 10) / 10) : null;
  const legBearing = nextWp ? computeBearing(wp.lat, wp.lng, nextWp.lat, nextWp.lng) : null;

  return (
    <div className="group flex items-start gap-2 rounded-lg border bg-card p-2.5 transition-colors hover:border-ocean/30">
      {/* Number badge */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ocean text-[10px] font-bold text-white">
        {index + 1}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => {
              onUpdate({ name: editName.trim() || `Waypoint ${index + 1}` });
              setIsEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUpdate({ name: editName.trim() || `Waypoint ${index + 1}` });
                setIsEditing(false);
              }
            }}
            autoFocus
            className="w-full rounded border bg-background px-1.5 py-0.5 text-xs font-medium focus:border-ocean focus:outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setEditName(wp.name || "");
              setIsEditing(true);
            }}
            className="text-left text-xs font-medium hover:text-ocean transition-colors"
          >
            {wp.name || `Waypoint ${index + 1}`}
          </button>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatCoord(wp.lat, true)}, {formatCoord(wp.lng, false)}
        </p>
        {legDistance !== null && (
          <p className="text-[10px] text-ocean/70 mt-0.5">
            {legDistance} nm {legBearing !== null ? `@ ${legBearing}\u00B0` : ""}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Route Creator ────────────────────────────────────────

export default function RouteCreator() {
  const {
    creationMode,
    inputMode,
    draftWaypoints,
    draftName,
    draftDescription,
    draftCourseType,
    draftIsPublic,
    isSaving,
    saveError,
    setInputMode,
    setDraftName,
    setDraftDescription,
    setDraftCourseType,
    setDraftIsPublic,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    reorderWaypoints,
    saveRoute,
    cancelCreation,
  } = useRouteStore();

  const totalDistance = computeTotalDistance(draftWaypoints);
  const canSave = draftName.trim().length > 0 && draftWaypoints.length >= 2;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          {creationMode === "editing" ? "Edit Route" : "Create Route"}
        </h2>
        <button
          onClick={cancelCreation}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Route Name & Type */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Route name (required)"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm font-medium placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean/30"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            className="w-full rounded-lg border bg-card px-3 py-2 text-xs placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean/30"
          />
          <div className="flex gap-2">
            <select
              value={draftCourseType}
              onChange={(e) => setDraftCourseType(e.target.value)}
              className="flex-1 rounded-lg border bg-card px-2.5 py-2 text-xs focus:border-ocean focus:outline-none"
            >
              <option value="passage">Passage</option>
              <option value="race">Race</option>
              <option value="cruise">Cruise</option>
              <option value="delivery">Delivery</option>
            </select>
            <label className="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={draftIsPublic}
                onChange={(e) => setDraftIsPublic(e.target.checked)}
                className="rounded border-muted-foreground/30"
              />
              <Globe className="h-3 w-3 text-muted-foreground" />
              Public
            </label>
          </div>
        </div>

        {/* Input Mode Toggle */}
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            onClick={() => setInputMode("map")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              inputMode === "map"
                ? "bg-ocean text-white"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Map className="h-3.5 w-3.5" />
            Tap on Map
          </button>
          <button
            onClick={() => setInputMode("manual")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              inputMode === "manual"
                ? "bg-ocean text-white"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            Coordinates
          </button>
        </div>

        {/* Map tap hint */}
        {inputMode === "map" && draftWaypoints.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-ocean/30 bg-ocean/5 p-3">
            <MapPin className="h-4 w-4 text-ocean shrink-0" />
            <p className="text-xs text-muted-foreground">
              Tap on the map to place waypoints. Each tap adds a numbered marker and draws the route line.
            </p>
          </div>
        )}

        {/* Manual entry form */}
        {inputMode === "manual" && (
          <ManualCoordInput onAdd={addWaypoint} />
        )}

        {/* Waypoint List */}
        {draftWaypoints.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Waypoints ({draftWaypoints.length})
              </p>
              {totalDistance > 0 && (
                <p className="text-xs font-medium text-ocean">
                  {totalDistance} nm total
                </p>
              )}
            </div>
            <div className="space-y-1">
              {draftWaypoints.map((wp, i) => (
                <WaypointItem
                  key={`${i}-${wp.lat}-${wp.lng}`}
                  wp={wp}
                  index={i}
                  total={draftWaypoints.length}
                  nextWp={i < draftWaypoints.length - 1 ? draftWaypoints[i + 1] : null}
                  onUpdate={(updates) => updateWaypoint(i, updates)}
                  onRemove={() => removeWaypoint(i)}
                  onMoveUp={() => i > 0 && reorderWaypoints(i, i - 1)}
                  onMoveDown={() => i < draftWaypoints.length - 1 && reorderWaypoints(i, i + 1)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Save Error */}
        {saveError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
          </div>
        )}
      </div>

      {/* Footer: Save / Cancel */}
      <div className="border-t p-4 space-y-2">
        <button
          onClick={saveRoute}
          disabled={!canSave || isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean px-4 py-3 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {creationMode === "editing" ? "Save Changes" : "Save Route"}
            </>
          )}
        </button>
        {!canSave && draftWaypoints.length < 2 && (
          <p className="text-center text-[10px] text-muted-foreground">
            {draftWaypoints.length === 0
              ? "Add at least 2 waypoints to save"
              : "Add 1 more waypoint to save"}
          </p>
        )}
      </div>
    </div>
  );
}
