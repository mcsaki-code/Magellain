"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/lib/types";

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner", desc: "Learning the basics" },
  { value: "intermediate", label: "Intermediate", desc: "Comfortable sailing in most conditions" },
  { value: "advanced", label: "Advanced", desc: "Racing regularly, strong tactical knowledge" },
  { value: "expert", label: "Expert", desc: "Championship-level racing experience" },
] as const;

const CLUB_OPTIONS = [
  "Ford Yacht Club",
  "West Shore Sailing Club",
  "Crescent Sail Yacht Club",
  "Detroit Yacht Club",
  "Bayview Yacht Club",
  "Grosse Pointe Yacht Club",
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) setProfile(data as Profile);
      setIsLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        display_name: profile.display_name,
        phone: profile.phone,
        sailing_experience: profile.sailing_experience,
        club_affiliations: profile.club_affiliations ?? [],
        emergency_contact_name: profile.emergency_contact_name,
        emergency_contact_phone: profile.emergency_contact_phone,
      })
      .eq("id", user.id);

    setIsSaving(false);
    setMessage(error
      ? { type: "error", text: "Failed to save profile" }
      : { type: "success", text: "Profile saved" }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-var(--nav-total-height))] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Profile">
        <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>
      <div className="space-y-6 p-4">
        {/* Basic Info */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">BASIC INFO</h2>
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Full Name</label>
              <input
                type="text"
                value={profile.full_name ?? ""}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Display Name</label>
              <input
                type="text"
                value={profile.display_name ?? ""}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                placeholder="Shown on leaderboards"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</label>
              <input
                type="tel"
                value={profile.phone ?? ""}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
            </div>
          </div>
        </section>

        {/* Sailing Experience */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">SAILING EXPERIENCE</h2>
          <div className="space-y-2">
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setProfile({ ...profile, sailing_experience: level.value })}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  profile.sailing_experience === level.value
                    ? "border-ocean bg-ocean/10"
                    : "bg-card hover:bg-muted"
                }`}
              >
                <p className="text-sm font-medium">{level.label}</p>
                <p className="text-xs text-muted-foreground">{level.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Club Affiliations */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">CLUB AFFILIATIONS</h2>
          <div className="flex flex-wrap gap-2">
            {CLUB_OPTIONS.map((club) => {
              const selected = (profile.club_affiliations ?? []).includes(club);
              return (
                <button
                  key={club}
                  onClick={() => {
                    const current = profile.club_affiliations ?? [];
                    setProfile({
                      ...profile,
                      club_affiliations: selected
                        ? current.filter((c) => c !== club)
                        : [...current, club],
                    });
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? "bg-ocean text-white"
                      : "border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {club}
                </button>
              );
            })}
          </div>
        </section>

        {/* Emergency Contact */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">EMERGENCY CONTACT</h2>
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Contact Name</label>
              <input
                type="text"
                value={profile.emergency_contact_name ?? ""}
                onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Contact Phone</label>
              <input
                type="tel"
                value={profile.emergency_contact_phone ?? ""}
                onChange={(e) => setProfile({ ...profile, emergency_contact_phone: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
            </div>
          </div>
        </section>

        {/* Save */}
        {message && (
          <div className={`rounded-lg p-3 text-center text-sm ${
            message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"
          }`}>
            {message.text}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3 text-sm font-semibold text-white transition-colors hover:bg-ocean-600 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Profile
        </button>
      </div>
    </div>
  );
}
