"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Shield,
  Download,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function PrivacyPage() {
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteComplete, setDeleteComplete] = useState(false);
  const [locationTracking, setLocationTracking] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  async function handleExport() {
    setExporting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Collect all user data
      const [profile, boats, tracks, routes, chatMessages, pushSubs, memberships] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("boats").select("*").eq("owner_id", user.id),
          supabase.from("gps_tracks").select("*").eq("user_id", user.id),
          supabase.from("routes").select("*").eq("owner_id", user.id),
          supabase.from("chat_messages").select("*").eq("user_id", user.id),
          supabase.from("push_subscriptions").select("id, endpoint, user_agent, created_at").eq("user_id", user.id),
          supabase.from("club_memberships").select("*, club:clubs(name)").eq("user_id", user.id),
        ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        profile: profile.data,
        boats: boats.data,
        gps_tracks: tracks.data,
        routes: routes.data,
        chat_messages: chatMessages.data,
        push_subscriptions: pushSubs.data,
        club_memberships: memberships.data,
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `magellain-data-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExported(true);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Delete user data from all tables (cascade will handle foreign keys)
      await Promise.all([
        supabase.from("gps_tracks").delete().eq("user_id", user.id),
        supabase.from("chat_messages").delete().eq("user_id", user.id),
        supabase.from("push_subscriptions").delete().eq("user_id", user.id),
        supabase.from("club_memberships").delete().eq("user_id", user.id),
        supabase.from("routes").delete().eq("owner_id", user.id),
        supabase.from("boats").delete().eq("owner_id", user.id),
        supabase.from("feedback").delete().eq("user_id", user.id),
      ]);

      // Clear profile data (keep row for auth but anonymize)
      await supabase
        .from("profiles")
        .update({
          full_name: null,
          display_name: "Deleted User",
          avatar_url: null,
          sailing_experience: null,
          club_affiliations: null,
          bio: null,
        })
        .eq("id", user.id);

      // Clear local storage
      localStorage.clear();

      setDeleteComplete(true);
      setConfirmDelete(false);

      // Sign out after short delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = "/sign-in";
      }, 3000);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-foreground">
            Privacy & Data
          </h1>
          <p className="text-xs text-muted-foreground">
            Control your data, privacy, and account
          </p>
        </div>
      </div>

      {/* Data collection settings */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Data Collection
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Location tracking</p>
            <p className="text-[10px] text-muted-foreground">
              GPS data for speedometer, tracks, and weather
            </p>
          </div>
          <button
            onClick={() => setLocationTracking(!locationTracking)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              locationTracking ? "bg-ocean" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                locationTracking ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Usage analytics</p>
            <p className="text-[10px] text-muted-foreground">
              Anonymous usage data to improve the app
            </p>
          </div>
          <button
            onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              analyticsEnabled ? "bg-ocean" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                analyticsEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* What we store */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            What We Store
          </span>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            <span className="font-medium text-foreground">Profile:</span>{" "}
            Name, email, experience level, club affiliations
          </p>
          <p>
            <span className="font-medium text-foreground">Boats:</span>{" "}
            Boat specs, sail inventory, PHRF ratings
          </p>
          <p>
            <span className="font-medium text-foreground">GPS Tracks:</span>{" "}
            Recorded sailing tracks with speed and position data
          </p>
          <p>
            <span className="font-medium text-foreground">Routes:</span>{" "}
            Saved navigation routes and waypoints
          </p>
          <p>
            <span className="font-medium text-foreground">
              Chat History:
            </span>{" "}
            Conversations with the AI Coach (stored for context)
          </p>
          <p>
            <span className="font-medium text-foreground">
              Push Subscriptions:
            </span>{" "}
            Device tokens for weather alert notifications
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground">
          All data is stored in Supabase with row-level security. We never
          sell or share your personal data with third parties.
        </p>
      </div>

      {/* Export */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Export Your Data
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Download a complete copy of all your data as a JSON file. This
          includes your profile, boats, GPS tracks, routes, and chat history.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3 text-sm font-semibold text-white hover:bg-ocean-600 disabled:opacity-50"
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : exported ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Downloaded
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export All Data
            </>
          )}
        </button>
      </div>

      {/* Delete account */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-red-500">
            Delete Account
          </span>
        </div>

        {deleteComplete ? (
          <div className="rounded-lg bg-red-500/10 px-3 py-3 text-center">
            <p className="text-sm font-medium text-red-500">
              Account data deleted. Signing out...
            </p>
          </div>
        ) : confirmDelete ? (
          <>
            <div className="rounded-lg bg-red-500/10 px-3 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-xs text-red-500 leading-relaxed">
                  This will permanently delete all your data including GPS
                  tracks, boats, routes, and chat history. This action cannot
                  be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete Everything"
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Permanently delete your account and all associated data. We
              recommend exporting your data first.
            </p>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete My Account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
