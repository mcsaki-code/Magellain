"use client";

import { useState, useEffect } from "react";
import { useMapStore } from "@/lib/store/map-store";
import { Flag, TrendingUp, X, Sailboat } from "lucide-react";
import { cn } from "@/lib/utils";

export function RaceToolsFab() {
  const [expanded, setExpanded] = useState(false);

  const {
    drawerActiveTab,
    showStartLineTool,
    setShowStartLineTool,
    clearStartLine,
    showWindShift,
    toggleWindShift,
  } = useMapStore();

  // Force collapse FAB when drawer opens
  useEffect(() => {
    if (drawerActiveTab !== null) setExpanded(false);
  }, [drawerActiveTab]);

  const anyToolActive = showStartLineTool || showWindShift;

  const items = [
    {
      id: "wind-shift",
      icon: <TrendingUp className="h-5 w-5" />,
      label: "Wind Shifts",
      active: showWindShift,
      onPress: () => { toggleWindShift(); setExpanded(false); },
    },
    {
      id: "start-line",
      icon: <Flag className="h-5 w-5" />,
      label: "Start Line Bias",
      active: showStartLineTool,
      onPress: () => {
        if (showStartLineTool) { setShowStartLineTool(false); clearStartLine(); }
        else setShowStartLineTool(true);
        setExpanded(false);
      },
    },
  ];

  const handleMain = () => {
    // Prevent expansion if drawer is open
    if (drawerActiveTab !== null) return;

    if (anyToolActive) {
      if (showStartLineTool) { setShowStartLineTool(false); clearStartLine(); }
      if (showWindShift) toggleWindShift();
      setExpanded(false);
    } else {
      setExpanded((p) => !p);
    }
  };

  return (
    <div className="absolute bottom-20 right-3 z-20 flex flex-col items-end gap-2">
      {/* Sub-buttons */}
      {expanded && (
        <div className="flex flex-col items-end gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="rounded-full bg-card/97 px-2.5 py-1 text-xs font-medium text-foreground shadow-md backdrop-blur-md">
                {item.label}
              </span>
              <button
                onClick={item.onPress}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full shadow-lg backdrop-blur-md transition-all active:scale-95",
                  item.active ? "bg-ocean text-white" : "bg-card/97 text-foreground hover:bg-card"
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
        onClick={handleMain}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-xl backdrop-blur-md transition-all active:scale-95",
          anyToolActive ? "bg-ocean text-white" : expanded ? "bg-foreground text-background" : "bg-card/97 text-foreground hover:bg-card"
        )}
        title="Race Tools"
      >
        {anyToolActive || expanded ? <X className="h-6 w-6" /> : <Sailboat className="h-6 w-6" />}
      </button>
    </div>
  );
}
