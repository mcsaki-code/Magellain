"use client";

import { useState } from "react";
import {
  Route,
  MapPin,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Globe,
  Lock,
  Navigation,
  ChevronDown,
  AlertTriangle,
  Sailboat,
  Anchor,
} from "lucide-react";
import { useRouteStore, computeTotalDistance, type PassageRoute } from "@/lib/store/route-store";

// ─── Route Card ───────────────────────────────────────────

function RouteCard({
  route,
  isSelected,
  isOwned,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  route: PassageRoute;
  isSelected: boolean;
  isOwned: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const courseIcon = () => {
    switch (route.course_type) {
      case "race":
        return <Navigation className="h-3.5 w-3.5" />;
      case "cruise":
        return <Sailboat className="h-3.5 w-3.5" />;
      case "delivery":
        return <Anchor className="h-3.5 w-3.5" />;
      default:
        return <Route className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div
      className={`rounded-lg border transition-all ${
        isSelected ? "border-ocean bg-ocean/5 ring-1 ring-ocean/20" : "bg-card hover:border-muted-foreground/30"
      }`}
    >
      <button onClick={onSelect} className="flex w-full items-start gap-3 p-3 text-left">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isSelected ? "bg-ocean text-white" : "bg-muted text-muted-foreground"
          }`}
        >
          {courseIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{route.name}</p>
            {route.is_public && !route.is_system && (
              <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            {!route.is_public && !route.is_system && (
              <Lock className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {route.departure_name} → {route.arrival_name}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
            {route.rhumb_line_distance_nm && <span>{route.rhumb_line_distance_nm} nm</span>}
            {route.waypoints?.length > 0 && <span>{route.waypoints.length} waypoints</span>}
            {route.difficulty && <span>{route.difficulty}</span>}
            {route.course_type && (
              <span className="capitalize">{route.course_type}</span>
            )}
          </div>
        </div>
        {isSelected && <div className="h-2 w-2 shrink-0 rounded-full bg-ocean mt-2" />}
      </button>

      {/* Actions for owned routes */}
      {isOwned && isSelected && (
        <div className="flex items-center gap-1 border-t px-3 py-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <Edit3 className="h-3 w-3" />
              Edit
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <Copy className="h-3 w-3" />
              Duplicate
            </button>
          )}
          <div className="flex-1" />
          {onDelete && !showConfirmDelete && (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
          {showConfirmDelete && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-red-500 font-medium">Delete?</span>
              <button
                onClick={() => {
                  onDelete?.();
                  setShowConfirmDelete(false);
                }}
                className="rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="rounded-md border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                No
              </button>
            </div>
          )}
        </div>
      )}

      {/* Duplicate action for system/community routes */}
      {!isOwned && isSelected && onDuplicate && (
        <div className="flex items-center gap-1 border-t px-3 py-2">
          <button
            onClick={onDuplicate}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <Copy className="h-3 w-3" />
            Duplicate as my route
          </button>
        </div>
      )}
    </div>
  );
}

// ─── My Routes Panel ──────────────────────────────────────

export default function MyRoutesPanel() {
  const {
    passages,
    systemRoutes,
    myRoutes,
    communityRoutes,
    selectedPassageId,
    setSelectedPassage,
    startCreating,
    startEditing,
    deleteRoute,
    duplicateRoute,
  } = useRouteStore();

  const [showSystem, setShowSystem] = useState(true);
  const [showCommunity, setShowCommunity] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header with Create button */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Routes</h2>
        <button
          onClick={startCreating}
          className="flex items-center gap-1.5 rounded-lg bg-ocean px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ocean/90 active:scale-[0.97]"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Route
        </button>
      </div>

      {/* Scrollable route list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* My Routes */}
        {myRoutes.length > 0 && (
          <div className="space-y-1.5">
            <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-ocean">
              My Routes ({myRoutes.length})
            </p>
            <div className="space-y-1.5">
              {myRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={selectedPassageId === route.id}
                  isOwned={true}
                  onSelect={() => setSelectedPassage(route.id)}
                  onEdit={() => startEditing(route)}
                  onDelete={() => deleteRoute(route.id)}
                  onDuplicate={() => duplicateRoute(route)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state for my routes */}
        {myRoutes.length === 0 && (
          <div className="rounded-xl border border-dashed border-ocean/30 bg-ocean/5 p-4 text-center">
            <MapPin className="mx-auto h-8 w-8 text-ocean/40 mb-2" />
            <p className="text-xs font-medium text-foreground">No custom routes yet</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Create your first route by tapping waypoints on the map or entering coordinates.
            </p>
            <button
              onClick={startCreating}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ocean px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-ocean/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Route
            </button>
          </div>
        )}

        {/* System Routes (collapsible) */}
        <div>
          <button
            onClick={() => setShowSystem(!showSystem)}
            className="flex w-full items-center justify-between px-1 py-1"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Pre-loaded Passages ({systemRoutes.length})
            </p>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showSystem ? "rotate-180" : ""}`}
            />
          </button>
          {showSystem && (
            <div className="mt-1.5 space-y-1.5">
              {systemRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={selectedPassageId === route.id}
                  isOwned={false}
                  onSelect={() => setSelectedPassage(route.id)}
                  onDuplicate={() => duplicateRoute(route)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Community Routes (collapsible) */}
        {communityRoutes.length > 0 && (
          <div>
            <button
              onClick={() => setShowCommunity(!showCommunity)}
              className="flex w-full items-center justify-between px-1 py-1"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Community Routes ({communityRoutes.length})
              </p>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showCommunity ? "rotate-180" : ""}`}
              />
            </button>
            {showCommunity && (
              <div className="mt-1.5 space-y-1.5">
                {communityRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    isSelected={selectedPassageId === route.id}
                    isOwned={false}
                    onSelect={() => setSelectedPassage(route.id)}
                    onDuplicate={() => duplicateRoute(route)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
