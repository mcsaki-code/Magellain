import Link from "next/link";
import { Header } from "@/components/layout/header";
import { User, Ship, Settings, LogOut, Shield, FileText, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const menuItems = [
  { label: "Profile", href: "/menu/profile", icon: User, description: "Your sailing profile" },
  { label: "My Boats", href: "/menu/boats", icon: Ship, description: "Manage your fleet" },
  { label: "Crew Messages", href: "/messages", icon: Users, description: "Chat with your crew" },
  { label: "Settings", href: "/menu/settings", icon: Settings, description: "App preferences" },
  { label: "Float Plan", href: "/menu/float-plan", icon: FileText, description: "Safety float plans" },
  { label: "Emergency", href: "/menu/emergency", icon: Shield, description: "Safety contacts" },
];

export default async function MenuPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Menu" />
      <div className="p-4">
        {user ? (
          <div className="space-y-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-medium text-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">Signed in</p>
            </div>
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-touch items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent"
                  >
                    <Icon className="h-5 w-5 text-ocean" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </nav>
            <form action="/auth/sign-out" method="POST">
              <button
                type="submit"
                className="flex min-h-touch w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <LogOut className="h-5 w-5 text-alert-red" />
                <span className="text-sm font-medium text-alert-red">
                  Sign Out
                </span>
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Sign in to access your profile, boats, and chat history.
              </p>
            </div>
            <Link
              href="/sign-in"
              className="flex min-h-touch items-center justify-center rounded-xl bg-ocean px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ocean-600"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="flex min-h-touch items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
