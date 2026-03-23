"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft, Save, Loader2, Trash2, Plus, Star, Ship,
} from "lucide-react";
import Link from "next/link";
import type { Boat } from "@/lib/types";

const KEEL_TYPES = ["fin", "fin-skeg", "lifting-keel", "centerboard", "long-keel", "wing-keel", "bulb-keel"] as const;
const RIG_TYPES = ["masthead-sloop", "fractional-sloop", "cutter", "yawl", "ketch", "cat"] as const;
const PROP_TYPES = ["fixed", "folding", "feathering", "none"] as const;
const SAIL_TYPES = ["mainsail", "jib", "genoa", "spinnaker-sym", "spinnaker-asym", "code-zero", "storm-jib", "trysail"] as const;
const CONDITIONS = ["new", "excellent", "good", "fair", "worn"] as const;

interface SailEntry {
  type: string;
  loft: string;
  year: string;
  condition: string;
  area: string;
}

export default function BoatDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [boat, setBoat] = useState<Boat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [sailNumber, setSailNumber] = useState("");
  const [phrfRating, setPhrfRating] = useState("");
  const [hullType, setHullType] = useState("monohull");
  const [loa, setLoa] = useState("");
  const [beam, setBeam] = useState("");
  const [draft, setDraft] = useState("");
  const [displacement, setDisplacement] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [keelType, setKeelType] = useState("");
  const [rigType, setRigType] = useState("");
  const [propType, setPropType] = useState("");
  const [sails, setSails] = useState<SailEntry[]>([]);

  const loadBoat = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("boats").select("*").eq("id", id).single();
    if (!data) {
      router.push("/menu/boats");
      return;
    }
    const b = data as Boat;
    setBoat(b);
    setName(b.name);
    setClassName(b.class_name);
    setSailNumber(b.sail_number ?? "");
    setPhrfRating(b.phrf_rating?.toString() ?? "");
    setHullType(b.hull_type);
    setLoa(b.loa_ft?.toString() ?? "");
    setBeam(b.beam_ft?.toString() ?? "");
    setDraft(b.draft_ft?.toString() ?? "");
    setDisplacement(b.displacement_lbs?.toString() ?? "");
    setYearBuilt(b.year_built?.toString() ?? "");
    setManufacturer(b.manufacturer ?? "");

    const raw = b.raw_data as Record<string, unknown> | null;
    setKeelType((raw?.keel_type as string) ?? "");
    setRigType((raw?.rig_type as string) ?? "");
    setPropType((raw?.propeller_type as string) ?? "");

    const savedSails = raw?.sail_inventory as SailEntry[] | undefined;
    if (savedSails?.length) {
      setSails(savedSails);
    }

    setIsLoading(false);
  }, [id, router]);

  useEffect(() => { loadBoat(); }, [loadBoat]);

  const addSail = () => setSails([...sails, { type: "mainsail", loft: "", year: "", condition: "good", area: "" }]);
  const removeSail = (i: number) => setSails(sails.filter((_, idx) => idx !== i));
  const updateSail = (i: number, field: keyof SailEntry, value: string) => {
    const next = [...sails];
    next[i] = { ...next[i], [field]: value };
    setSails(next);
  };

  const handleSave = async () => {
    if (!name.trim() || !className.trim()) return;
    setIsSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("boats")
      .update({
        name: name.trim(),
        class_name: className.trim(),
        sail_number: sailNumber.trim() || null,
        phrf_rating: phrfRating ? Number(phrfRating) : null,
        hull_type: hullType,
        loa_ft: loa ? Number(loa) : null,
        beam_ft: beam ? Number(beam) : null,
        draft_ft: draft ? Number(draft) : null,
        displacement_lbs: displacement ? Number(displacement) : null,
        year_built: yearBuilt ? Number(yearBuilt) : null,
        manufacturer: manufacturer.trim() || null,
        raw_data: {
          ...(boat?.raw_data as Record<string, unknown> ?? {}),
          keel_type: keelType || null,
          rig_type: rigType || null,
          propeller_type: propType || null,
          sail_inventory: sails.length ? sails : null,
        },
      })
      .eq("id", id);

    setIsSaving(false);
    if (!error) router.push("/menu/boats");
  };

  const handleSetPrimary = async () => {
    if (!boat) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Clear primary on all boats, then set this one
    await supabase.from("boats").update({ is_primary: false }).eq("owner_id", user.id);
    await supabase.from("boats").update({ is_primary: true }).eq("id", id);
    setBoat({ ...boat, is_primary: true });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const supabase = createClient();
    await supabase.from("boats").delete().eq("id", id);
    router.push("/menu/boats");
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <Header title="Boat Details">
          <Link href="/menu/boats" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Header>
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Edit Boat">
        <Link href="/menu/boats" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>

      <div className="space-y-6 p-4 pb-32">
        {/* Primary badge */}
        {boat?.is_primary && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
            <Star className="h-4 w-4 fill-current" />
            Primary boat — used for AI coaching
          </div>
        )}

        {/* Boat Details */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">BOAT DETAILS</h2>
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Boat Name *"
              className="w-full rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
            <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class Name *"
              className="w-full rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <input value={sailNumber} onChange={(e) => setSailNumber(e.target.value)} placeholder="Sail Number"
                className="rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
              <input value={phrfRating} onChange={(e) => setPhrfRating(e.target.value)} placeholder="PHRF Rating" type="number"
                className="rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
            </div>
            <select value={hullType} onChange={(e) => setHullType(e.target.value)}
              className="w-full rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none">
              <option value="monohull">Monohull</option>
              <option value="multihull">Multihull</option>
            </select>
          </div>
        </section>

        {/* Dimensions */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">DIMENSIONS</h2>
          <div className="grid grid-cols-2 gap-3">
            <input value={loa} onChange={(e) => setLoa(e.target.value)} placeholder="LOA (ft)" type="number" step="0.01"
              className="rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
            <input value={beam} onChange={(e) => setBeam(e.target.value)} placeholder="Beam (ft)" type="number" step="0.01"
              className="rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Draft (ft)" type="number" step="0.01"
              className="rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
            <input value={displacement} onChange={(e) => setDisplacement(e.target.value)} placeholder="Displacement (lbs)" type="number"
              className="rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} placeholder="Year Built" type="number"
              className="rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
            <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Manufacturer"
              className="rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none" />
          </div>
        </section>

        {/* Rigging */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">RIGGING</h2>
          <select value={keelType} onChange={(e) => setKeelType(e.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none">
            <option value="">Select Keel Type</option>
            {KEEL_TYPES.map((k) => <option key={k} value={k}>{k.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
          </select>
          <select value={rigType} onChange={(e) => setRigType(e.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none">
            <option value="">Select Rig Type</option>
            {RIG_TYPES.map((r) => <option key={r} value={r}>{r.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
          </select>
          <select value={propType} onChange={(e) => setPropType(e.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm focus:border-ocean focus:outline-none">
            <option value="">Select Propeller Type</option>
            {PROP_TYPES.map((p) => <option key={p} value={p}>{p.replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
          </select>
        </section>

        {/* Sail Inventory */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">SAIL INVENTORY</h2>
            <button onClick={addSail} className="flex items-center gap-1 text-xs font-medium text-ocean">
              <Plus className="h-3.5 w-3.5" /> Add Sail
            </button>
          </div>
          {sails.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No sails added yet</p>
          )}
          {sails.map((sail, i) => (
            <div key={i} className="rounded-xl border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <select value={sail.type} onChange={(e) => updateSail(i, "type", e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none">
                  {SAIL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                </select>
                <button onClick={() => removeSail(i)} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={sail.loft} onChange={(e) => updateSail(i, "loft", e.target.value)} placeholder="Sailmaker / Loft"
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
                <input value={sail.area} onChange={(e) => updateSail(i, "area", e.target.value)} placeholder="Area (sqft)" type="number"
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={sail.year} onChange={(e) => updateSail(i, "year", e.target.value)} placeholder="Year" type="number"
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none" />
                <select value={sail.condition} onChange={(e) => updateSail(i, "condition", e.target.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none">
                  {CONDITIONS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>
          ))}
        </section>

        {/* Actions */}
        <section className="space-y-3">
          {!boat?.is_primary && (
            <button onClick={handleSetPrimary}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 py-3 text-sm font-semibold text-yellow-600 dark:text-yellow-400">
              <Star className="h-4 w-4" /> Set as Primary Boat
            </button>
          )}

          <button onClick={handleSave} disabled={isSaving || !name.trim() || !className.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3 text-sm font-semibold text-white disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>

          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 py-3 text-sm font-medium text-red-500">
              <Trash2 className="h-4 w-4" /> Delete Boat
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-center text-sm font-medium text-red-500">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-lg border py-2 text-sm text-muted-foreground hover:bg-muted">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={isDeleting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white">
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
