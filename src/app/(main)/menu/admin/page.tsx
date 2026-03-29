"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import Link from "next/link";
import {
  ArrowLeft, BarChart3, Users, Eye, Globe, Ship, Navigation,
  Cpu, MessageSquare, TrendingUp, AlertCircle, Loader2,
  ChevronDown, ChevronUp, RefreshCw, Clock, Check, X,
  MessageCircle, Pencil
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────
interface FeedbackItem {
  id: number;
  category: string;
  subject: string;
  message?: string;
  status: string;
  admin_notes?: string;
  created_at: string;
  email: string | null;
}

interface TelemetryData {
  period: { days: number; since: string };
  kpis: {
    totalPageViews: number;
    uniqueSessions: number;
    uniqueUsers: number;
    totalProfiles: number;
    totalBoats: number;
    totalRoutes: number;
    totalComputations: number;
  };
  topPages: { path: string; views: number }[];
  trend: { date: string; views: number }[];
  topEvents: { event: string; count: number }[];
  feedback: {
    items: FeedbackItem[];
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

// ─── Sparkline Bar Chart ─────────────────────────────────
function SparkBars({ data, height = 48 }: { data: { date: string; views: number }[]; height?: number }) {
  if (!data.length) return <p className="text-xs text-muted-foreground">No data yet</p>;
  const max = Math.max(...data.map((d) => d.views), 1);
  const barW = Math.max(4, Math.floor(280 / data.length) - 1);

  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {data.slice(-30).map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${d.views} views`}
          className="rounded-sm bg-ocean transition-all hover:bg-ocean-400"
          style={{ width: barW, height: Math.max(2, (d.views / max) * height) }}
        />
      ))}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color = "text-ocean" }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className={`rounded-lg bg-muted p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────
function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-ocean" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="rounded-full bg-ocean/10 px-1.5 py-0.5 text-[10px] font-bold text-ocean">
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t border-border px-4 py-3">{children}</div>}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-ocean/10 text-ocean",
    read: "bg-muted text-muted-foreground",
    in_progress: "bg-alert-yellow/10 text-alert-yellow",
    resolved: "bg-alert-green/10 text-alert-green",
    closed: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] || colors.new}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    suggestion: "bg-ocean/10 text-ocean",
    bug: "bg-alert-red/10 text-alert-red",
    help: "bg-alert-yellow/10 text-alert-yellow",
    other: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[category] || colors.other}`}>
      {category}
    </span>
  );
}

// ─── Feedback Card (Expanded) ────────────────────────────
function FeedbackCard({
  item,
  onUpdateStatus,
  onUpdateNotes,
}: {
  item: FeedbackItem;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
  onUpdateNotes: (id: number, notes: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(item.admin_notes || "");
  const [saving, setSaving] = useState(false);

  const statuses = ["new", "read", "in_progress", "resolved", "closed"];

  const handleSaveNotes = async () => {
    setSaving(true);
    await onUpdateNotes(item.id, notes);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded && item.status === "new") {
            onUpdateStatus(item.id, "read");
          }
        }}
        className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <CategoryBadge category={item.category} />
            <StatusBadge status={item.status} />
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground truncate">{item.subject}</p>
          {item.email && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{item.email}</p>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border p-3 space-y-3">
          {/* Message content */}
          {item.message && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Message</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{item.message}</p>
            </div>
          )}

          {/* Status actions */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Update Status</p>
            <div className="flex flex-wrap gap-1">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(item.id, s)}
                  disabled={item.status === s}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    item.status === s
                      ? "bg-ocean text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Admin notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-muted-foreground font-medium">Admin Notes</p>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-[10px] text-ocean hover:text-ocean-600"
                >
                  <Pencil className="h-3 w-3" />
                  {item.admin_notes ? "Edit" : "Add note"}
                </button>
              )}
            </div>
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes about this feedback..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving}
                    className="flex items-center gap-1 rounded-lg bg-ocean px-3 py-1.5 text-xs font-medium text-white hover:bg-ocean-600 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setNotes(item.admin_notes || "");
                    }}
                    className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : item.admin_notes ? (
              <p className="text-xs text-foreground bg-muted/50 rounded-lg p-2 whitespace-pre-wrap">
                {item.admin_notes}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">No notes yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page Name Helper ────────────────────────────────────
function friendlyName(path: string): string {
  const names: Record<string, string> = {
    "/home": "Home",
    "/map": "Chart / Map",
    "/route-planner": "Route Planner",
    "/chat": "AI Coach",
    "/weather": "Weather",
    "/races": "Races",
    "/performance": "Performance",
    "/menu": "Menu",
    "/menu/boats": "My Boats",
    "/menu/profile": "Profile",
    "/menu/settings": "Settings",
    "/menu/help": "Help",
    "/menu/about": "About",
    "/menu/emergency": "Emergency",
    "/menu/float-plan": "Float Plan",
    "/menu/admin": "Admin Dashboard",
    "/menu/feedback": "Send Feedback",
  };
  return names[path] || path;
}

// ═════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════
export default function AdminDashboardPage() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/telemetry?days=${days}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Failed (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Feedback Actions ──────────────────────────────────
  const updateFeedbackStatus = useCallback(async (id: number, status: string) => {
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      // Update local state
      setData((prev) => {
        if (!prev) return prev;
        const items = prev.feedback.items.map((f) =>
          f.id === id ? { ...f, status } : f
        );
        // Recompute byStatus
        const byStatus: Record<string, number> = {};
        items.forEach((f) => {
          byStatus[f.status] = (byStatus[f.status] || 0) + 1;
        });
        return {
          ...prev,
          feedback: { ...prev.feedback, items, byStatus },
        };
      });
    } catch {
      // Silent fail — user sees stale state
    }
  }, []);

  const updateFeedbackNotes = useCallback(async (id: number, admin_notes: string) => {
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, admin_notes }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setData((prev) => {
        if (!prev) return prev;
        const items = prev.feedback.items.map((f) =>
          f.id === id ? { ...f, admin_notes } : f
        );
        return { ...prev, feedback: { ...prev.feedback, items } };
      });
    } catch {
      // Silent fail
    }
  }, []);

  const newCount = data?.feedback.byStatus.new || 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Admin Dashboard">
        <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>

      <div className="flex flex-col gap-4 p-4 pb-24">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === d
                    ? "bg-ocean text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Loading / Error */}
        {loading && !data && (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-ocean" />
            <span className="text-sm text-muted-foreground">Loading telemetry...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-alert-red/30 bg-alert-red/5 p-4">
            <AlertCircle className="h-4 w-4 text-alert-red" />
            <p className="text-sm text-alert-red">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* ─── KPI Grid ─────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              <KpiCard icon={Eye} label="Page Views" value={data.kpis.totalPageViews.toLocaleString()} />
              <KpiCard icon={Globe} label="Sessions" value={data.kpis.uniqueSessions.toLocaleString()} />
              <KpiCard icon={Users} label="Auth Users" value={data.kpis.uniqueUsers.toLocaleString()} />
              <KpiCard icon={Users} label="Total Profiles" value={data.kpis.totalProfiles.toLocaleString()} color="text-alert-green" />
              <KpiCard icon={Ship} label="Boats" value={data.kpis.totalBoats.toLocaleString()} />
              <KpiCard icon={Navigation} label="Routes" value={data.kpis.totalRoutes.toLocaleString()} />
              <KpiCard icon={Cpu} label="Computations" value={data.kpis.totalComputations.toLocaleString()} />
              <KpiCard
                icon={Clock}
                label="Avg Views/Session"
                value={
                  data.kpis.uniqueSessions > 0
                    ? (data.kpis.totalPageViews / data.kpis.uniqueSessions).toFixed(1)
                    : "0"
                }
              />
            </div>

            {/* ─── Daily Trend ──────────────────────────── */}
            <Section title="Daily Page Views" icon={TrendingUp}>
              <SparkBars data={data.trend} height={56} />
              {data.trend.length > 0 && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {data.trend[0]?.date} — {data.trend[data.trend.length - 1]?.date}
                </p>
              )}
            </Section>

            {/* ─── Top Pages ────────────────────────────── */}
            <Section title="Most Visited Pages" icon={BarChart3}>
              {data.topPages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No page views yet</p>
              ) : (
                <div className="space-y-1.5">
                  {data.topPages.map((p, i) => {
                    const maxViews = data.topPages[0]?.views || 1;
                    return (
                      <div key={p.path} className="flex items-center gap-2">
                        <span className="w-5 text-right text-[10px] font-mono text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground truncate">
                              {friendlyName(p.path)}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground ml-2">
                              {p.views}
                            </span>
                          </div>
                          <div className="mt-0.5 h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-ocean"
                              style={{ width: `${(p.views / maxViews) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* ─── Top Events ───────────────────────────── */}
            <Section title="Feature Events" icon={Cpu} defaultOpen={false}>
              {data.topEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events tracked yet</p>
              ) : (
                <div className="space-y-1">
                  {data.topEvents.map((e) => (
                    <div key={e.event} className="flex items-center justify-between">
                      <span className="text-xs text-foreground">{e.event}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{e.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ─── User Feedback (Enhanced) ─────────────── */}
            <Section title="User Feedback" icon={MessageSquare} badge={newCount}>
              {/* Category / Status summary */}
              {Object.keys(data.feedback.byCategory).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(data.feedback.byCategory).map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-1">
                      <CategoryBadge category={cat} />
                      <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
                    </div>
                  ))}
                  <span className="text-muted-foreground/30 mx-1">|</span>
                  {Object.entries(data.feedback.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-1">
                      <StatusBadge status={status} />
                      <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {data.feedback.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">No feedback submitted yet</p>
              ) : (
                <div className="space-y-2">
                  {data.feedback.items.slice(0, 25).map((f) => (
                    <FeedbackCard
                      key={f.id}
                      item={f}
                      onUpdateStatus={updateFeedbackStatus}
                      onUpdateNotes={updateFeedbackNotes}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* ─── Data Summary ─────────────────────────── */}
            <Section title="Database Summary" icon={BarChart3} defaultOpen={false}>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">Profiles</p>
                  <p className="text-lg font-bold text-foreground">{data.kpis.totalProfiles}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">Boats</p>
                  <p className="text-lg font-bold text-foreground">{data.kpis.totalBoats}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">Passage Routes</p>
                  <p className="text-lg font-bold text-foreground">{data.kpis.totalRoutes}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-muted-foreground">Route Computations</p>
                  <p className="text-lg font-bold text-foreground">{data.kpis.totalComputations}</p>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
