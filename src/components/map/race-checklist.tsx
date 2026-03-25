"use client";

import { useState } from "react";
import { useMapStore } from "@/lib/store/map-store";
import { LayoutList, X, RotateCcw, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Checklist data ───────────────────────────────────────────────

interface CheckItem {
  id: string;
  label: string;
}

interface CheckCategory {
  id: string;
  title: string;
  emoji: string;
  items: CheckItem[];
}

const CATEGORIES: CheckCategory[] = [
  {
    id: "rig",
    title: "Rig",
    emoji: "▲",
    items: [
      { id: "rig-mast", label: "Mast step / partners secure" },
      { id: "rig-shrouds", label: "Shrouds, forestay, backstay tight" },
      { id: "rig-halyards", label: "All halyards run clean, no twists" },
      { id: "rig-vang", label: "Boom vang functional" },
      { id: "rig-backstay", label: "Backstay adjuster / runner ready" },
      { id: "rig-cunningham", label: "Cunningham / downhaul ready" },
      { id: "rig-spreaders", label: "Spreader tips taped" },
    ],
  },
  {
    id: "sails",
    title: "Sails",
    emoji: "◇",
    items: [
      { id: "sail-main", label: "Main halyard up and locked" },
      { id: "sail-jib", label: "Jib / headsail hanked on or furled" },
      { id: "sail-battens", label: "Batten tension set" },
      { id: "sail-telltales", label: "Telltales in good condition" },
      { id: "sail-numbers", label: "Sail numbers visible both sides" },
      { id: "sail-spin", label: "Spinnaker packed and ready (if used)" },
      { id: "sail-sheets", label: "Sheets led correctly, no twists" },
    ],
  },
  {
    id: "safety",
    title: "Safety",
    emoji: "◉",
    items: [
      { id: "safe-pfds", label: "PFDs / life jackets for all crew" },
      { id: "safe-horn", label: "Horn or whistle aboard" },
      { id: "safe-throwable", label: "Throwable flotation device" },
      { id: "safe-flares", label: "Visual distress signals (flares)" },
      { id: "safe-vhf", label: "VHF radio charged, channel 16 set" },
      { id: "safe-firstaid", label: "First aid kit accessible" },
    ],
  },
  {
    id: "boat",
    title: "Boat",
    emoji: "◻",
    items: [
      { id: "boat-bung", label: "Drain plug / bung installed" },
      { id: "boat-hatches", label: "Hatches closed and latched" },
      { id: "boat-bilge", label: "Bilge dry (pump if needed)" },
      { id: "boat-fire", label: "Fire extinguisher accessible" },
      { id: "boat-crew", label: "Crew weight distributed for conditions" },
    ],
  },
  {
    id: "raceday",
    title: "Race Day",
    emoji: "⚑",
    items: [
      { id: "race-protest", label: "Protest flag aboard" },
      { id: "race-class", label: "Class / division flag displayed" },
      { id: "race-watch", label: "Watch / timer synchronized with RC" },
      { id: "race-course", label: "Course number confirmed" },
      { id: "race-brief", label: "Crew briefed: signals, rules, plan" },
      { id: "race-startplan", label: "Start plan agreed (end, time, tack)" },
    ],
  },
];

const ALL_IDS = CATEGORIES.flatMap((c) => c.items.map((i) => i.id));

// ─── Component ───────────────────────────────────────────────────

export function RaceChecklist() {
  const { showChecklist, toggleChecklist } = useMapStore();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [openCategory, setOpenCategory] = useState<string>("rig");

  if (!showChecklist) return null;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalItems = ALL_IDS.length;
  const doneCount = ALL_IDS.filter((id) => checked.has(id)).length;
  const pct = Math.round((doneCount / totalItems) * 100);

  const catDone = (cat: CheckCategory) => cat.items.filter((i) => checked.has(i.id)).length;

  return (
    <div className="absolute right-2 top-2 z-20 flex w-72 flex-col rounded-xl bg-card/97 shadow-2xl backdrop-blur-sm"
      style={{ maxHeight: "calc(100dvh - var(--nav-total-height) - 1.5rem)", overflowY: "auto" }}>

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-border bg-card/98 px-3 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <LayoutList className="h-4 w-4 text-ocean" />
          <span className="text-sm font-bold text-foreground">Pre-Race Checklist</span>
        </div>
        <button onClick={toggleChecklist} className="rounded p-1 hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="border-b border-border px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {doneCount} / {totalItems} items
          </span>
          <span className={cn(
            "font-bold",
            pct === 100 ? "text-green-600 dark:text-green-400" :
            pct >= 70 ? "text-amber-500" : "text-muted-foreground"
          )}>
            {pct === 100 ? "All clear!" : `${pct}%`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              pct === 100 ? "bg-green-500" : "bg-ocean"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Category accordion */}
      <div className="divide-y divide-border">
        {CATEGORIES.map((cat) => {
          const done = catDone(cat);
          const total = cat.items.length;
          const isOpen = openCategory === cat.id;
          const allDone = done === total;

          return (
            <div key={cat.id}>
              <button
                onClick={() => setOpenCategory(isOpen ? "" : cat.id)}
                className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-muted/40"
              >
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    "text-sm font-semibold",
                    allDone ? "text-green-600 dark:text-green-400" : "text-foreground"
                  )}>
                    {cat.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs tabular-nums",
                    allDone ? "text-green-600 dark:text-green-400 font-semibold" : "text-muted-foreground"
                  )}>
                    {done}/{total}
                  </span>
                  <span className={cn(
                    "text-xs text-muted-foreground transition-transform",
                    isOpen ? "rotate-90" : ""
                  )}>▶</span>
                </div>
              </button>

              {isOpen && (
                <div className="pb-2 pl-3 pr-3">
                  {cat.items.map((item) => {
                    const isChecked = checked.has(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggle(item.id)}
                        className={cn(
                          "mb-1 flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                          isChecked
                            ? "bg-green-500/8 hover:bg-green-500/12"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition-colors",
                          isChecked
                            ? "border-green-500 bg-green-500"
                            : "border-muted-foreground/50"
                        )}>
                          {isChecked && (
                            <svg viewBox="0 0 10 10" className="h-full w-full fill-white p-0.5">
                              <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className={cn(
                          "text-sm leading-snug",
                          isChecked ? "text-muted-foreground line-through" : "text-foreground"
                        )}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-card/98 px-3 py-2 backdrop-blur-sm">
        <button
          onClick={() => setChecked(new Set())}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        <button
          onClick={() => setChecked(new Set(ALL_IDS))}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Check All
        </button>
      </div>
    </div>
  );
}
