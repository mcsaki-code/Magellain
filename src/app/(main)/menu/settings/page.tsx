"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { useTheme } from "@/components/layout/theme-provider";
import { ArrowLeft, Sun, Moon, Monitor, Gauge } from "lucide-react";
import Link from "next/link";

const THEME_OPTIONS: { value: "light" | "dark" | "system"; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const SPEED_UNITS = [
  { value: "kts", label: "Knots", desc: "Standard nautical (kts)" },
  { value: "mph", label: "Miles per hour", desc: "Statute miles (mph)" },
  { value: "kmh", label: "Kilometers per hour", desc: "Metric (km/h)" },
  { value: "nmh", label: "Nautical miles per hour", desc: "Same as knots (nm/h)" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [speedUnit, setSpeedUnit] = useState("kts");

  useEffect(() => {
    const savedUnit = localStorage.getItem("magellain-speed-unit");
    if (savedUnit) setSpeedUnit(savedUnit);
  }, []);

  const handleUnitChange = (unit: string) => {
    setSpeedUnit(unit);
    localStorage.setItem("magellain-speed-unit", unit);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Settings">
        <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>
      <div className="space-y-6 p-4">
        {/* Theme */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">APPEARANCE</h2>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                  theme === value ? "border-ocean bg-ocean/10" : "bg-card hover:bg-muted"
                }`}
              >
                <Icon className={`h-6 w-6 ${theme === value ? "text-ocean" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Speed Units */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">SPEED UNITS</h2>
          </div>
          <div className="space-y-2">
            {SPEED_UNITS.map((u) => (
              <button
                key={u.value}
                onClick={() => handleUnitChange(u.value)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  speedUnit === u.value ? "border-ocean bg-ocean/10" : "bg-card hover:bg-muted"
                }`}
              >
                <p className="text-sm font-medium">{u.label}</p>
                <p className="text-xs text-muted-foreground">{u.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* About */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">ABOUT</h2>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold">MagellAIn</p>
            <p className="text-xs text-muted-foreground">v1.0.0 MVP</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Sailing intelligence platform for Great Lakes racing sailors.
              Built for Ford Yacht Club and West Shore Sailing Club.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
