"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft, Phone, Shield, MapPin, Send,
  AlertTriangle, Anchor, UserCircle, Plus, Trash2,
} from "lucide-react";
import Link from "next/link";

// USCG Sector Detroit covers Lake Erie / Detroit River area
const USCG_SECTORS = [
  { name: "USCG Sector Detroit", phone: "313-568-9564", area: "Detroit River / Western Lake Erie" },
  { name: "USCG Station Toledo", phone: "419-691-4048", area: "Maumee Bay / Toledo" },
  { name: "USCG Emergency (VHF 16)", phone: "911", area: "All emergencies" },
];

interface EmergencyContact {
  id?: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function EmergencyPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [profileContact, setProfileContact] = useState<{ name: string; phone: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<EmergencyContact>({ name: "", phone: "", relationship: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setIsLoggedIn(true);

        // Load profile emergency contact
        const { data: profile } = await supabase
          .from("profiles")
          .select("emergency_contact_name, emergency_contact_phone")
          .eq("id", user.id)
          .single();

        if (profile?.emergency_contact_name && profile?.emergency_contact_phone) {
          setProfileContact({
            name: profile.emergency_contact_name,
            phone: profile.emergency_contact_phone,
          });
        }

        // Load emergency contacts from dedicated table
        const { data: contactData } = await supabase
          .from("emergency_contacts")
          .select("*")
          .eq("user_id", user.id)
          .order("is_primary", { ascending: false });

        if (contactData) {
          setContacts(contactData as EmergencyContact[]);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const getLocation = () => {
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const sendSOS = (contact: { name: string; phone: string }) => {
    const locStr = location
      ? `Location: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} (https://maps.google.com/?q=${location.lat},${location.lng})`
      : "Location unavailable";
    const body = encodeURIComponent(`SOS from MagellAIn - I need assistance. ${locStr}`);
    window.open(`sms:${contact.phone}?body=${body}`, "_self");
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.phone) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase
      .from("emergency_contacts")
      .insert({ user_id: user.id, name: newContact.name, phone: newContact.phone, relationship: newContact.relationship })
      .select()
      .single();

    if (!error && data) {
      setContacts([...contacts, data as EmergencyContact]);
      setNewContact({ name: "", phone: "", relationship: "" });
      setShowAddContact(false);
    }
    setSaving(false);
  };

  const deleteContact = async (id: string) => {
    const supabase = createClient();
    await supabase.from("emergency_contacts").delete().eq("id", id);
    setContacts(contacts.filter((c) => c.id !== id));
  };

  const allContacts = [
    ...(profileContact ? [{ ...profileContact, relationship: "Profile emergency contact", id: "profile" }] : []),
    ...contacts,
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Emergency">
        <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>

      <div className="space-y-4 p-4">
        {/* Emergency Call Buttons */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">EMERGENCY CALLS</h2>

          {/* 911 / VHF 16 prominent button */}
          <a
            href="tel:911"
            className="flex items-center gap-4 rounded-xl border-2 border-red-500 bg-red-500/10 p-4 transition-colors active:bg-red-500/20"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500">
              <Phone className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-red-600 dark:text-red-400">Call 911</p>
              <p className="text-xs text-muted-foreground">Life-threatening emergencies</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Also hail on VHF Channel 16</p>
            </div>
          </a>

          {/* Coast Guard stations */}
          {USCG_SECTORS.filter((s) => s.phone !== "911").map((sector) => (
            <a
              key={sector.phone}
              href={`tel:${sector.phone}`}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors active:bg-muted"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ocean/10">
                <Anchor className="h-5 w-5 text-ocean" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{sector.name}</p>
                <p className="text-xs text-muted-foreground">{sector.area}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-ocean">{sector.phone}</p>
              </div>
            </a>
          ))}
        </section>

        {/* Location & SOS */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">SHARE YOUR LOCATION</h2>
          <div className="rounded-xl border bg-card p-4">
            {location ? (
              <div className="mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </span>
              </div>
            ) : (
              <button
                onClick={getLocation}
                disabled={locationLoading}
                className="mb-3 flex items-center gap-2 rounded-lg bg-ocean/10 px-4 py-2 text-sm font-medium text-ocean transition-colors hover:bg-ocean/20"
              >
                <MapPin className="h-4 w-4" />
                {locationLoading ? "Getting location..." : "Get My Location"}
              </button>
            )}

            <p className="text-xs text-muted-foreground">
              Tap a contact below to send an SOS text with your GPS coordinates.
            </p>
          </div>
        </section>

        {/* Emergency Contacts */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">EMERGENCY CONTACTS</h2>
            {isLoggedIn && (
              <button
                onClick={() => setShowAddContact(!showAddContact)}
                className="flex items-center gap-1 text-xs font-medium text-ocean"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            )}
          </div>

          {/* Add contact form */}
          {showAddContact && (
            <div className="space-y-2 rounded-xl border bg-card p-4">
              <input
                type="text"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="Contact name"
                className="w-full rounded-lg border bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
              <input
                type="tel"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                placeholder="Phone number"
                className="w-full rounded-lg border bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
              <input
                type="text"
                value={newContact.relationship}
                onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                placeholder="Relationship (optional)"
                className="w-full rounded-lg border bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
              />
              <button
                onClick={addContact}
                disabled={saving || !newContact.name || !newContact.phone}
                className="w-full rounded-xl bg-ocean px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save Contact"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : allContacts.length > 0 ? (
            <div className="space-y-2">
              {allContacts.map((contact) => (
                <div
                  key={contact.id ?? contact.phone}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3"
                >
                  <UserCircle className="h-8 w-8 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                    {contact.relationship && (
                      <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => sendSOS(contact)}
                      className="rounded-lg bg-red-500/10 p-2 text-red-500 transition-colors active:bg-red-500/20"
                      title="Send SOS"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                    <a
                      href={`tel:${contact.phone}`}
                      className="rounded-lg bg-ocean/10 p-2 text-ocean transition-colors active:bg-ocean/20"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    {contact.id && contact.id !== "profile" && (
                      <button
                        onClick={() => deleteContact(contact.id!)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-6 text-center">
              <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No emergency contacts set up</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isLoggedIn ? "Add contacts above, or set one in your profile." : "Sign in to save emergency contacts."}
              </p>
            </div>
          )}
        </section>

        {/* Safety tips */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">SAFETY REMINDERS</h2>
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
              <p className="text-xs text-muted-foreground">
                Always file a float plan before departing. Monitor VHF Channel 16 at all times.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
              <p className="text-xs text-muted-foreground">
                Wear a PFD. Cold water on Lake Erie can incapacitate in minutes. Carry a whistle and mirror.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
              <p className="text-xs text-muted-foreground">
                If capsized: stay with the boat, signal for help, conserve energy.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
