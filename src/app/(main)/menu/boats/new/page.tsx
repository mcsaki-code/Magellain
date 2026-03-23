"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

const HULL_TYPES = ["monohull", "multihull"] as const;
const KEEL_TYPES = ["fin", "fin-skeg", "lifting-keel", "centerboard", "long-keel", "wing-keel", "bulb-keel"] as const;
const RIG_TYPES = ["masthead-sloop", "fractional-sloop", "cutter", "yawl", "ketch", "cat"] as const;
const PROP_TYPES = ["fixed", "folding", "feathering", "none"] as const;

const POPULAR_CLASSES = [
  { name: "S2 7.9", loa: 25.92, beam: 9.5, draft: 5.0, displacement: 4250, phrf: 168, desc: "26' one-design racer/cruiser. FYC Fleet 15 — the largest active fleet on the Detroit River.", category: "One-Design" },
  { name: "J/24", loa: 24.0, beam: 8.92, draft: 4.0, displacement: 3100, phrf: 171, desc: "24' classic one-design keelboat. One of the most popular racing sailboats worldwide.", category: "One-Design" },
  { name: "Cal 25", loa: 25.0, beam: 8.0, draft: 4.0, displacement: 4000, phrf: 168, desc: "25' racer/cruiser. Reliable all-rounder common in PHRF fleets on the Great Lakes.", category: "PHRF Racer/Cruiser" },
  { name: "J/70", loa: 22.75, beam: 7.33, draft: 4.75, displacement: 1750, phrf: 108, desc: "23' high-performance sportboat. Fast planing hull, active one-design class.", category: "Sportboat" },
  { name: "Melges 24", loa: 24.0, beam: 8.25, draft: 4.75, displacement: 1880, phrf: 87, desc: "24' grand prix sportboat. Ultra-competitive, one of the fastest boats per foot.", category: "Sportboat" },
  { name: "J/105", loa: 34.5, beam: 11.0, draft: 6.5, displacement: 7750, phrf: 84, desc: "34' performance one-design. Popular offshore racer, excellent in heavy air.", category: "Performance" },
  { name: "J/120", loa: 40.0, beam: 12.17, draft: 7.0, displacement: 14500, phrf: 48, desc: "40' performance cruiser. Fast PHRF A boat, built for distance and buoy racing.", category: "Performance" },
  { name: "Tartan 10", loa: 33.25, beam: 10.33, draft: 5.67, displacement: 8500, phrf: 132, desc: "33' Tim Farris design. Iconic Great Lakes racer popular in DRYA and PHRF fleets.", category: "PHRF Racer" },
];

interface SailEntry {
  type: string;
  loft: string;
  year: string;
  condition: string;
  area_sqft: string;
}

export default function NewBoatPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [boat, setBoat] = useState({
    name: "",
    class_name: "",
    hull_type: "monohull" as string,
    loa_ft: "",
    beam_ft: "",
    draft_ft: "",
    displacement_lbs: "",
    sail_number: "",
    phrf_rating: "",
    one_design_class: "",
    year_built: "",
    manufacturer: "",
    model: "",
    is_primary: true,
  });

  const [setup, setSetup] = useState({
    keel_type: "",
    rig_type: "",
    prop_type: "",
  });

  const [sails, setSails] = useState<SailEntry[]>([
    { type: "mainsail", loft: "", year: "", condition: "good", area_sqft: "" },
    { type: "jib", loft: "", year: "", condition: "good", area_sqft: "" },
  ]);

  const populateFromClass = (className: string) => {
    const preset = POPULAR_CLASSES.find((c) => c.name === className);
    if (preset) {
      setBoat({
        ...boat,
        class_name: preset.name,
        one_design_class: preset.name,
        loa_ft: String(preset.loa),
        beam_ft: String(preset.beam),
        draft_ft: String(preset.draft),
        displacement_lbs: String(preset.displacement),
        phrf_rating: String(preset.phrf),
      });
    }
  };

  const addSail = () => {
    setSails([...sails, { type: "genoa", loft: "", year: "", condition: "good", area_sqft: "" }]);
  };

  const removeSail = (idx: number) => {
    setSails(sails.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!boat.name || !boat.class_name) {
      setError("Boat name and class are required");
      return;
    }

    setIsSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in"); setIsSaving(false); return; }

    // Build sail inventory
    const sail_inventory: Record<string, { area_sqft?: number; type?: string; loft?: string; year?: number; condition?: string }> = {};
    sails.forEach((s, i) => {
      sail_inventory[`${s.type}_${i}`] = {
        type: s.type,
        ...(s.area_sqft ? { area_sqft: Number(s.area_sqft) } : {}),
        ...(s.loft ? { loft: s.loft } : {}),
        ...(s.year ? { year: Number(s.year) } : {}),
        condition: s.condition,
      };
    });

    const { error: dbError } = await supabase.from("boats").insert({
      owner_id: user.id,
      name: boat.name,
      class_name: boat.class_name,
      hull_type: boat.hull_type,
      loa_ft: boat.loa_ft ? Number(boat.loa_ft) : null,
      beam_ft: boat.beam_ft ? Number(boat.beam_ft) : null,
      draft_ft: boat.draft_ft ? Number(boat.draft_ft) : null,
      displacement_lbs: boat.displacement_lbs ? Number(boat.displacement_lbs) : null,
      sail_number: boat.sail_number || null,
      phrf_rating: boat.phrf_rating ? Number(boat.phrf_rating) : null,
      one_design_class: boat.one_design_class || null,
      year_built: boat.year_built ? Number(boat.year_built) : null,
      manufacturer: boat.manufacturer || null,
      model: boat.model || null,
      sail_inventory,
      is_primary: boat.is_primary,
      raw_data: {
        keel_type: setup.keel_type,
        rig_type: setup.rig_type,
        prop_type: setup.prop_type,
      },
    });

    setIsSaving(false);
    if (dbError) {
      setError(dbError.message);
    } else {
      router.push("/menu/boats");
    }
  };

  return (
    <div className="flex flex-col pb-8">
      <Header title="Add Boat">
        <Link href="/menu/boats" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>
      <div className="space-y-6 p-4">
        {/* Quick Select */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">QUICK SELECT CLASS</h2>
          <p className="text-xs text-muted-foreground">
            Tap a boat class to auto-fill specs. These are the most common classes racing on the Detroit River and Lake Erie.
          </p>
          <div className="space-y-2">
            {POPULAR_CLASSES.map((c) => (
              <button
                key={c.name}
                onClick={() => populateFromClass(c.name)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  boat.class_name === c.name ? "border-ocean bg-ocean/10" : "bg-card hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${boat.class_name === c.name ? "text-ocean" : ""}`}>{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{c.category}</span>
                    <span className="text-[10px] text-muted-foreground">PHRF {c.phrf}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Basic Info */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">BOAT DETAILS</h2>
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Boat Name *</label>
              <input type="text" value={boat.name} onChange={(e) => setBoat({ ...boat, name: e.target.value })}
                placeholder="e.g. Wind Dancer" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Class *</label>
                <input type="text" value={boat.class_name} onChange={(e) => setBoat({ ...boat, class_name: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Sail Number</label>
                <input type="text" value={boat.sail_number} onChange={(e) => setBoat({ ...boat, sail_number: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">PHRF Rating</label>
                <input type="number" value={boat.phrf_rating} onChange={(e) => setBoat({ ...boat, phrf_rating: e.target.value })}
                  placeholder="e.g. 168" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Hull Type</label>
                <select value={boat.hull_type} onChange={(e) => setBoat({ ...boat, hull_type: e.target.value })}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">
                  {HULL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Dimensions */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">DIMENSIONS</h2>
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">LOA (ft)</label>
              <input type="number" step="0.1" value={boat.loa_ft} onChange={(e) => setBoat({ ...boat, loa_ft: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Beam (ft)</label>
              <input type="number" step="0.1" value={boat.beam_ft} onChange={(e) => setBoat({ ...boat, beam_ft: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Draft (ft)</label>
              <input type="number" step="0.1" value={boat.draft_ft} onChange={(e) => setBoat({ ...boat, draft_ft: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Displacement (lbs)</label>
              <input type="number" value={boat.displacement_lbs} onChange={(e) => setBoat({ ...boat, displacement_lbs: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Year Built</label>
              <input type="number" value={boat.year_built} onChange={(e) => setBoat({ ...boat, year_built: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Manufacturer</label>
              <input type="text" value={boat.manufacturer} onChange={(e) => setBoat({ ...boat, manufacturer: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean" />
            </div>
          </div>
        </section>

        {/* Rigging & Setup */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">RIGGING & SETUP</h2>
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Keel Type</label>
              <select value={setup.keel_type} onChange={(e) => setSetup({ ...setup, keel_type: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">
                <option value="">Select...</option>
                {KEEL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/-/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Rig Type</label>
              <select value={setup.rig_type} onChange={(e) => setSetup({ ...setup, rig_type: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">
                <option value="">Select...</option>
                {RIG_TYPES.map((t) => <option key={t} value={t}>{t.replace(/-/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Propeller Type</label>
              <select value={setup.prop_type} onChange={(e) => setSetup({ ...setup, prop_type: e.target.value })}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean">
                <option value="">Select...</option>
                {PROP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Sail Inventory */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">SAIL INVENTORY</h2>
            <button onClick={addSail} className="flex items-center gap-1 text-xs font-medium text-ocean hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add Sail
            </button>
          </div>
          <div className="space-y-3">
            {sails.map((sail, i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <select value={sail.type} onChange={(e) => { const s = [...sails]; s[i] = { ...s[i], type: e.target.value }; setSails(s); }}
                    className="rounded-lg border bg-background px-2 py-1 text-sm font-medium focus:border-ocean focus:outline-none">
                    {["mainsail", "jib", "genoa", "spinnaker-sym", "spinnaker-asym", "code-zero", "storm-jib", "trysail"].map((t) => (
                      <option key={t} value={t}>{t.replace(/-/g, " ")}</option>
                    ))}
                  </select>
                  {sails.length > 1 && (
                    <button onClick={() => removeSail(i)} className="p-1 text-muted-foreground hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Sail loft" value={sail.loft}
                    onChange={(e) => { const s = [...sails]; s[i] = { ...s[i], loft: e.target.value }; setSails(s); }}
                    className="rounded-lg border bg-background px-2 py-1.5 text-xs focus:border-ocean focus:outline-none" />
                  <input type="number" placeholder="Area (sq ft)" value={sail.area_sqft}
                    onChange={(e) => { const s = [...sails]; s[i] = { ...s[i], area_sqft: e.target.value }; setSails(s); }}
                    className="rounded-lg border bg-background px-2 py-1.5 text-xs focus:border-ocean focus:outline-none" />
                  <input type="number" placeholder="Year" value={sail.year}
                    onChange={(e) => { const s = [...sails]; s[i] = { ...s[i], year: e.target.value }; setSails(s); }}
                    className="rounded-lg border bg-background px-2 py-1.5 text-xs focus:border-ocean focus:outline-none" />
                  <select value={sail.condition} onChange={(e) => { const s = [...sails]; s[i] = { ...s[i], condition: e.target.value }; setSails(s); }}
                    className="rounded-lg border bg-background px-2 py-1.5 text-xs focus:border-ocean focus:outline-none">
                    {["new", "excellent", "good", "fair", "worn"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && <div className="rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-500">{error}</div>}

        <button onClick={handleSave} disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3 text-sm font-semibold text-white transition-colors hover:bg-ocean-600 disabled:opacity-50">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Boat
        </button>
      </div>
    </div>
  );
}
