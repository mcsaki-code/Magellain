"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Map, Cloud, MessageSquare, Menu, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { OfflineIndicator } from "./offline-indicator";

const navItems = [
  { key: "home",    label: "Home",    href: "/home",    icon: Compass },
  { key: "map",     label: "Map",     href: "/map",     icon: Map },
  { key: "route",   label: "Route",   href: "/route-planner", icon: Navigation },
  { key: "chat",    label: "Coach",   href: "/chat",    icon: MessageSquare },
  { key: "menu",    label: "Menu",    href: "/menu",    icon: Menu },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      <OfflineIndicator />
      <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        // Single physical-pixel top border that respects DPR instead of
        // the default 1px CSS border which renders as 2px on Retina/3x screens
        boxShadow: "0 -0.5px 0 0 hsl(var(--border))",
      }}
    >
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex min-h-touch min-w-touch flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "text-ocean"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "stroke-[2.5]" : "stroke-[1.5]"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
