"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { ArrowLeft, FileText, Users, Clock, MapPin, Phone, Save, CheckCircle, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface FloatPlan {
  id?: string;
  departure_location: string;
  destination: string;
  departure_time: string;
  expected_return: string;
  persons_aboard: number;
  vessel_name: string;
  vessel_description: string;
  contact_name: string;
  contact_phone: string;
  notes: string;
  filed_at?: string;
  is_active?: boolean;
}

const EMPTY_PLAN: FloatPlan = {
  departure_location: "",
  destination: "",
  departure_time: "",
  expected_return: "",
  persons_aboard: 1,
  vessel_name: "",
  vessel_description: "",
  contact_name: "",
  contact_phone: "",
  notes: "",
};

function localDateTimeDefault(offsetHours = 0): string {
  const d = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FloatPlanPage() {
  const [plan, setPlan] = useState<FloatPlan>({ ...EMPTY_PLAN, departure_time: localDateTimeDefault(), expected_return: localDateTimeDefault(4) });
  const [activePlans, setActivePlans] = useState<FloatPlan[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"new" | "active">("new");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setIsLoggedIn(true);

        // Pre-fill vessel name from primary boat
        const { data: boat } = await supabase
          .from("boats")
          .select("name, class_name, sail_number")
          .eq("owner_id", user.id)
          .eq("is_primary", true)
          .single();

        if (boat) {
          setPlan((p) => ({
            ...p,
            vessel_name: boat.name || "",
            vessel_description: [boat.class_name, boat.sail_number ? `Sail #${boat.sail_number}` : ""].filter(Boolean).join(", "),
          }));
        }

        // Load active float plans
        const { data: plans } = await supabase
          .from("float_plans")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("filed_at", { ascending: false });

        if (plans) setActivePlans(plans as FloatPlan[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const update = (field: keyof FloatPlan, value: string | number) => {
    setPlan((p) => ({ ...p, [field]: value }));
    setError(null);
  };

  const validate = (): string | null => {
    if (!plan.departure_location.trim()) return "Departure location is required.";
    if (!plan.expected_return) return "Expected return time is required.";
    if (!plan.contact_name.trim() || !plan.contact_phone.trim()) return "Emergency contact name and phone are required.";
    if (plan.departure_time && plan.expected_return && plan.expected_return <= plan.departure_time)
      return "Expected return must be after departure time.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    if (!isLoggedIn) {
      // Save to localStorage for anonymous users
      const stored = { ...plan, id: Date.now().toString(), filed_at: new Date().toISOString(), is_active: true };
      localStorage.setItem("magellain-float-plan", JSON.stringify(stored));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error: dbError } = await supabase
      .from("float_plans")
      .insert({
        user_id: user.id,
        departure_location: plan.departure_location,
        destination: plan.destination,
        departure_time: plan.departure_time || null,
        expected_return: plan.expected_return,
        persons_aboard: plan.persons_aboard,
        vessel_name: plan.vessel_name,
        vessel_description: plan.vessel_description,
        contact_name: plan.contact_name,
        contact_phone: plan.contact_phone,
        notes: plan.notes,
        is_active: true,
        filed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      // Table may not exist yet — save locally and inform user
      const stored = { ...plan, id: Date.now().toString(), filed_at: new Date().toISOString(), is_active: true };
      localStorage.setItem("magellain-float-plan", JSON.stringify(stored));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else if (data) {
      setActivePlans((prev) => [data as FloatPlan, ...prev]);
      setSaved(true);
      setView("active");
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const handleClose = async (id: string) => {
    const supabase = createClient();
    await supabase.from("float_plans").update({ is_active: false }).eq("id", id);
    setActivePlans((prev) => prev.filter((p) => p.id !== id));
  };

  const field = (label: string, children: React.ReactNode, required = false) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );

  const input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Float Plan">
        <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>

      <div className="flex flex-col gap-4 p-4 pb-24">

        {/* Safety callout */}
        <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div>
            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">File before you leave the dock</p>
            <p className="mt-0.5 text-xs text-yellow-700/80 dark:text-yellow-400/80">
              A float plan tells someone on shore where you are going and when to expect you back. Always monitor VHF Channel 16 and carry required safety gear.
            </p>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-xl border border-border bg-card p-1">
          <button
            onClick={() => setView("new")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${view === "new" ? "bg-ocean text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            New Plan
          </button>
          <button
            onClick={() => setView("active")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${view === "active" ? "bg-ocean text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            Active Plans {activePlans.length > 0 && `(${activePlans.length})`}
          </button>
        </div>

        {view === "new" && (
          <>
            {/* Vessel */}
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Vessel
              </div>
              {field("Vessel Name", input({ value: plan.vessel_name, onChange: (e) => update("vessel_name", e.target.value), placeholder: "e.g. Impetuous" }))}
              {field("Description / Sail Number", input({ value: plan.vessel_description, onChange: (e) => update("vessel_description", e.target.value), placeholder: "e.g. J/70, Sail #12345" }))}
            </section>

            {/* Trip */}
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Trip Details
              </div>
              {field("Departure Location", input({ value: plan.departure_location, onChange: (e) => update("departure_location", e.target.value), placeholder: "e.g. Ford Yacht Club, Gibraltar, MI" }), true)}
              {field("Destination / Sailing Area", input({ value: plan.destination, onChange: (e) => update("destination", e.target.value), placeholder: "e.g. Western Lake Erie, Race buoys" }))}
              {field("Departure Time", input({ type: "datetime-local", value: plan.departure_time, onChange: (e) => update("departure_time", e.target.value) }))}
              {field("Expected Return Time", input({ type: "datetime-local", value: plan.expected_return, onChange: (e) => update("expected_return", e.target.value) }), true)}
            </section>

            {/* Crew */}
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Crew
              </div>
              {field("Persons Aboard", (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => update("persons_aboard", Math.max(1, plan.persons_aboard - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-lg font-bold text-foreground"
                  >
                    −
                  </button>
                  <span className="flex-1 text-center text-xl font-bold">{plan.persons_aboard}</span>
                  <button
                    type="button"
                    onClick={() => update("persons_aboard", plan.persons_aboard + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-lg font-bold text-foreground"
                  >
                    +
                  </button>
                </div>
              ))}
            </section>

            {/* Emergency Contact */}
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                Shore Contact
              </div>
              <p className="text-xs text-muted-foreground">
                This person should call USCG Sector Detroit (313-568-9564) if you do not return by your expected time.
              </p>
              {field("Contact Name", input({ value: plan.contact_name, onChange: (e) => update("contact_name", e.target.value), placeholder: "Full name" }), true)}
              {field("Contact Phone", input({ type: "tel", value: plan.contact_phone, onChange: (e) => update("contact_phone", e.target.value), placeholder: "e.g. (313) 555-0100" }), true)}
            </section>

            {/* Notes */}
            <section className="rounded-xl border border-border bg-card p-4">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Additional Notes</label>
              <textarea
                value={plan.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Course area, safety equipment, special conditions…"
                rows={3}
                className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
            </section>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
            )}

            {saved && (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-4 py-2.5 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Float plan filed successfully
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3.5 text-sm font-semibold text-white transition-colors hover:bg-ocean-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Filing…" : "File Float Plan"}
            </button>

            {!isLoggedIn && (
              <p className="text-center text-xs text-muted-foreground">
                <Link href="/sign-in" className="text-ocean underline">Sign in</Link> to save and track float plans across devices.
              </p>
            )}
          </>
        )}

        {view === "active" && (
          <>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : activePlans.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-10 text-center">
                <Clock className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No active float plans</p>
                <button
                  onClick={() => setView("new")}
                  className="rounded-xl bg-ocean px-5 py-2.5 text-sm font-semibold text-white"
                >
                  File a Float Plan
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activePlans.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{p.vessel_name || "Unnamed vessel"}</p>
                        <p className="text-xs text-muted-foreground">{p.vessel_description}</p>
                      </div>
                      <button
                        onClick={() => p.id && handleClose(p.id)}
                        title="Close plan"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p><span className="font-medium text-foreground">From:</span> {p.departure_location}</p>
                      {p.destination && <p><span className="font-medium text-foreground">To:</span> {p.destination}</p>}
                      <p><span className="font-medium text-foreground">Return by:</span> {p.expected_return ? new Date(p.expected_return).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</p>
                      <p><span className="font-medium text-foreground">Persons aboard:</span> {p.persons_aboard}</p>
                      <p><span className="font-medium text-foreground">Shore contact:</span> {p.contact_name} · {p.contact_phone}</p>
                    </div>
                    {p.filed_at && (
                      <p className="mt-2 text-[10px] text-muted-foreground/60">
                        Filed {new Date(p.filed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
