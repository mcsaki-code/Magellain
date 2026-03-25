"use client";

import { useState } from "react";
import { useMapStore } from "@/lib/store/map-store";
import { Flag, TrendingUp, LayoutList, X, Sailboat } from "lucide-react";
import { cn } from "@/lib/utils";

interface FabItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  activeCheck: boolean;
  onPress: () => void;
}

export function RaceToolsFab() {
  const [expanded, setExpanded] = useState(false);

  const {
    showStartLineTool,
    setShowStartLineTool,
    clearStartLine,
    showWindShift,
    toggleWindShift,
    showChecklist,
    toggleChecklist,
  } = useMapStore();

  const anyToolActive = showStartLineTool || showWindShift || showChecklist;

  const items: FabItem[] = [
    {
      id: "checklist",
      icon: <LayoutList className="h-5 w-5" />,
      label: "Pre-Race Checklist",
      activeCheck: showChecklist,
      onPress: () => { toggleChecklist(); setExpanded(false); },
    },
    {
      id: "wind-shift",
      icon: <TrendingUp className="h-5 w-5" />,
      label: "Wind Shifts",
      activeCheck: showWindShift,
      onPress: () => { toggleWindShift(); setExpanded(false); },
    },
    {
      id: "start-line",
      icon: <Flag className="h-5 w-5" />,
      label: "Start Line Bias",
      activeCheck: showStartLineTool,
      onPress: () => {
        if (showStartLineTool) {
          setShowStartLineTool(false);
          clearStartLine();
        } else {
          setShowStartLineTool(true);
        }
        setExpanded(false);
      },
    },
  ];

  const handleMainPress = () => {
    if (anyToolActive) {
      // Close all tools
      if (showStartLineTool) { setShowStartLineTool(false); clearStartLine(); }
      if (showWindShift) toggleWindShift();
      if (showChecklist) toggleChecklist();
      setExpanded(false);
    } else {
      setExpanded((prev) => !prev);
    }
  };

  return (
    <div className="absolute bottom-4 right-3 z-20 flex flex-col items-end gap-2">
      {/* Sub-buttons (expand upward) */}
      {expanded && (
        <div className="flex flex-col items-end gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              {/* Label pill */}
              <span className="rounded-full bg-card/97 px-2.5 py-1 text-xs font-medium text-foreground shadow-md backdrop-blur-md">
                {item.label}
              </span>
              {/* Sub-FAB button */}
              <button
                onClick={item.onPress}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full shadow-lg backdrop-blur-md transition-all active:scale-95",
                  item.activeCheck
                    ? "bg-ocean text-white"
                    : "bg-card/97 text-foreground hover:bg-card"
                )}
              >
                {item.icon}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={handleMainPress}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-xl backdrop-blur-md transition-all active:scale-95",
          anyToolActive
            ? "bg-ocean text-white"
            : expanded
            ? "bg-foreground text-background"
            : "bg-card/97 text-foreground hover:bg-card"
        )}
        title="Race Tools"
      >
        {anyToolActive ? (
          <X className="h-6 w-6" />
        ) : expanded ? (
          <X className="h-6 w-6" />
        ) : (
          <Sailboat className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
