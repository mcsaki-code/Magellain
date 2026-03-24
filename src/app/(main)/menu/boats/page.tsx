"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Plus, Ship, Star, Loader2, ChevronRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { Boat } from "@/lib/types";

export default function BoatsPage() {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("boats")
        .select("*")
        .eq("owner_id", user.id)
        .order("is_primary", { ascending: false });

      if (data) setBoats(data as Boat[]);
      setIsLoading(false);
    }
    load();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="My Boats">
        <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>
      <div className="space-y-4 p-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : boats.length === 0 ? (
          <div className="py-12 text-center">
            <Ship className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No boats registered yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Add your boat to get personalized sailing advice
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {boats.map((boat) => (
              <div
                key={boat.id}
                className="flex items-center gap-2 rounded-xl border bg-card p-4 transition-colors"
              >
                <Link
                  href={`/menu/boats/${boat.id}`}
                  className="flex flex-1 items-center gap-3 min-w-0"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ocean/10">
                    <Ship className="h-5 w-5 text-ocean" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{boat.name}</p>
                      {boat.is_primary && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {boat.class_name}
                      {boat.sail_number ? ` | #${boat.sail_number}` : ""}
                      {boat.phrf_rating ? ` | PHRF ${boat.phrf_rating}` : ""}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/menu/boats/${boat.id}/performance`}
                    className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="View performance"
                  >
                    <TrendingUp className="h-4 w-4" />
                  </Link>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/menu/boats/new"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ocean py-3 text-sm font-semibold text-white transition-colors hover:bg-ocean-600"
        >
          <Plus className="h-4 w-4" />
          Add Boat
        </Link>
      </div>
    </div>
  );
}
