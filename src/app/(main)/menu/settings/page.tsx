"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { useTheme } from "@/components/layout/theme-provider";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Sun, Moon, Monitor, Gauge, Lock, Eye, EyeOff, Check } from "lucide-react";
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const savedUnit = localStorage.getItem("magellain-speed-unit");
    if (savedUnit) setSpeedUnit(savedUnit);

    // Check auth status
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

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

        {/* Password Change */}
        {isLoggedIn && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">CHANGE PASSWORD</h2>
            </div>
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full rounded-lg border bg-muted px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground/60 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-lg border bg-muted px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
              {passwordError && (
                <p className="text-xs text-red-500">{passwordError}</p>
              )}
              {passwordSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-green-500">
                  <Check className="h-3.5 w-3.5" />
                  Password updated successfully
                </div>
              )}
              <button
                onClick={handlePasswordChange}
                disabled={passwordSaving || !newPassword || !confirmPassword}
                className="w-full rounded-xl bg-ocean px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ocean-600 disabled:opacity-40"
              >
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </section>
        )}

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
