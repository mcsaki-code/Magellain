"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  MapPin,
  Globe,
  Users,
  Sailboat,
  Crown,
  Shield,
  Plus,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Club {
  id: string;
  name: string;
  short_name: string | null;
  address: string | null;
  website: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
}

interface Membership {
  id: string;
  club_id: string;
  role: string;
  is_primary: boolean;
  status: string;
  joined_at: string;
  club: Club;
}

interface Fleet {
  id: string;
  fleet_name: string;
  boat_class: string | null;
  phrf_rating: number | null;
  is_one_design: boolean;
  member_count: number;
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof Crown }> = {
  owner: { label: "Owner", icon: Crown },
  admin: { label: "Admin", icon: Shield },
  race_committee: { label: "Race Committee", icon: Sailboat },
  officer: { label: "Officer", icon: Shield },
  member: { label: "Member", icon: Users },
};

export default function ClubPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id || null);

    // Load all active clubs
    const { data: clubsData } = await supabase
      .from("clubs")
      .select("*")
      .eq("is_active", true)
      .order("name");

    setClubs(clubsData || []);

    // Load user memberships
    if (user) {
      const { data: memberData } = await supabase
        .from("club_memberships")
        .select("*, club:clubs(*)")
        .eq("user_id", user.id)
        .eq("status", "active");

      setMemberships((memberData as unknown as Membership[]) || []);
    }

    setLoading(false);
  }

  async function loadFleets(clubId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("club_fleets")
      .select("*")
      .eq("club_id", clubId)
      .order("fleet_name");
    setFleets(data || []);
  }

  async function handleJoin(club: Club) {
    if (!userId) return;
    setJoining(club.id);
    const supabase = createClient();

    const isPrimary = memberships.length === 0;
    await supabase.from("club_memberships").insert({
      club_id: club.id,
      user_id: userId,
      role: "member",
      is_primary: isPrimary,
    });

    await loadData();
    setJoining(null);
  }

  async function handleLeave(membershipId: string) {
    const supabase = createClient();
    await supabase.from("club_memberships").delete().eq("id", membershipId);
    await loadData();
    setSelectedClub(null);
  }

  function selectClub(club: Club) {
    setSelectedClub(club);
    loadFleets(club.id);
  }

  const memberClubIds = new Set(memberships.map((m) => m.club_id));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ocean" />
      </div>
    );
  }

  // Club detail view
  if (selectedClub) {
    const membership = memberships.find((m) => m.club_id === selectedClub.id);
    return (
      <div className="flex flex-col gap-4 p-4 pb-24">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedClub(null)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">
              {selectedClub.name}
            </h1>
            {selectedClub.short_name && (
              <span className="text-xs text-muted-foreground">
                {selectedClub.short_name}
              </span>
            )}
          </div>
        </div>

        {/* Club info */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {selectedClub.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {selectedClub.description}
            </p>
          )}
          {selectedClub.address && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {selectedClub.address}
            </div>
          )}
          {selectedClub.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={selectedClub.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ocean underline"
              >
                {selectedClub.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>

        {/* Membership status */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <span className="text-sm font-semibold text-foreground">
            Membership
          </span>
          {membership ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-ocean/10 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-ocean" />
                <span className="text-sm font-medium text-ocean">
                  {ROLE_LABELS[membership.role]?.label || membership.role}
                </span>
                {membership.is_primary && (
                  <span className="ml-auto rounded-full bg-ocean/20 px-2 py-0.5 text-[10px] font-medium text-ocean">
                    Primary Club
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Member since{" "}
                {new Date(membership.joined_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <button
                onClick={() => handleLeave(membership.id)}
                className="w-full rounded-xl border border-red-500/30 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10"
              >
                Leave Club
              </button>
            </>
          ) : (
            <button
              onClick={() => handleJoin(selectedClub)}
              disabled={joining === selectedClub.id || !userId}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3 text-sm font-semibold text-white hover:bg-ocean-600 disabled:opacity-50"
            >
              {joining === selectedClub.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Join {selectedClub.short_name || selectedClub.name}
            </button>
          )}
        </div>

        {/* Fleets */}
        {fleets.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <span className="text-sm font-semibold text-foreground">
              Active Fleets
            </span>
            <div className="space-y-2">
              {fleets.map((fleet) => (
                <div
                  key={fleet.id}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {fleet.fleet_name}
                    </span>
                    {fleet.is_one_design && (
                      <span className="ml-2 rounded-full bg-ocean/10 px-1.5 py-0.5 text-[9px] font-medium text-ocean">
                        One Design
                      </span>
                    )}
                    {fleet.phrf_rating && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        PHRF {fleet.phrf_rating}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {fleet.member_count} boats
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!userId && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
            Sign in to join clubs and access member features.
          </p>
        )}
      </div>
    );
  }

  // Club list view
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex items-center gap-3">
        <Link
          href="/menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-foreground">Yacht Clubs</h1>
          <p className="text-xs text-muted-foreground">
            Join clubs, view fleets, and connect with fellow racers
          </p>
        </div>
      </div>

      {/* My clubs */}
      {memberships.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            My Clubs
          </span>
          {memberships.map((m) => (
            <button
              key={m.id}
              onClick={() => selectClub(m.club)}
              className="flex w-full items-center gap-3 rounded-xl border border-ocean/20 bg-ocean/5 p-3 text-left transition-colors hover:bg-ocean/10"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ocean/20 text-ocean font-bold text-sm">
                {m.club.short_name || m.club.name.charAt(0)}
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-foreground">
                  {m.club.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {ROLE_LABELS[m.role]?.label || m.role}
                  </span>
                  {m.is_primary && (
                    <span className="text-[10px] text-ocean font-medium">
                      Primary
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* All clubs */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {memberships.length > 0 ? "Other Clubs" : "Available Clubs"}
        </span>
        {clubs
          .filter((c) => !memberClubIds.has(c.id))
          .map((club) => (
            <button
              key={club.id}
              onClick={() => selectClub(club)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground font-bold text-sm">
                {club.short_name || club.name.charAt(0)}
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-foreground">
                  {club.name}
                </span>
                {club.address && (
                  <p className="text-[10px] text-muted-foreground">
                    {club.address}
                  </p>
                )}
              </div>
            </button>
          ))}

        {clubs.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No clubs registered yet. Check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
