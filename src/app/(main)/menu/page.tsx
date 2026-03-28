import Link from "next/link";
import { Header } from "@/components/layout/header";
import { User, Ship, Settings, LogOut, Shield, FileText, Trophy, HelpCircle, Info, BarChart3, Sailboat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const menuItems = [
  { label: "Profile",      href: "/menu/profile",    icon: User,       description: "Your sailing profile" },
  { label: "Race Tools",   href: "/map",             icon: Sailboat,   description: "Wind shifts, start line & courses" },
  { label: "My Boats",     href: "/menu/boats",       icon: Ship,       description: "Manage your fleet" },
  { label: "Races",        href: "/races",            icon: Trophy,     description: "Schedules & results" },
  { label: "Performance",  href: "/performance",      icon: BarChart3,  description: "Analytics & standings" },
  { label: "Float Plan",   href: "/menu/float-plan",  icon: FileText,   description: "Safety float plans" },
  { label: "Emergency",    href: "/menu/emergency",   icon: Shield,     description: "USCG & safety contacts" },
  { label: "Settings",     href: "/menu/settings",    icon: Settings,   description: "App preferences" },
  { label: "Help",         href: "/menu/help",        icon: HelpCircle, description: "How to use MagellAIn" },
  { label: "About",        href: "/menu/about",       icon: Info,       description: "App info, data sources & legal" },
];

// Items visible to anonymous (not-signed-in) users
const publicItems = [
  { label: "Races",        href: "/races",            icon: Trophy,     description: "Schedules & results" },
  { label: "Emergency",    href: "/menu/emergency",   icon: Shield,     description: "USCG & safety contacts" },
  { label: "Help",         href: "/menu/help",        icon: HelpCircle, description: "How to use MagellAIn" },
  { label: "About",        href: "/menu/about",       icon: Info,       description: "App info, data sources & legal" },
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
                Sign in to access your profile, boats, and race history.
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
            <nav className="space-y-1 pt-2">
              {publicItems.map((item) => {
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
          </div>
        )}
      </div>
    </div>
  );
}
