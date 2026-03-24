"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { ArrowLeft, ChevronDown, ChevronUp, Search, HelpCircle } from "lucide-react";
import Link from "next/link";
import helpContent from "@/lib/content/help-content.json";

type HelpItem = { id: string; title: string; content: string };
type HelpSection = { id: string; title: string; description: string; items: HelpItem[] };

const sections: HelpSection[] = Object.values(helpContent.sections);

export default function HelpPage() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["getting-started"]));
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const q = query.toLowerCase().trim();

  const filtered = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          section.title.toLowerCase().includes(q)
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Help">
        <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>

      <div className="flex flex-col gap-4 p-4 pb-24">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help topics…"
            className="w-full rounded-xl border border-border bg-card py-3 pl-9 pr-4 text-sm placeholder:text-muted-foreground/60 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
          />
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
            <HelpCircle className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {/* Sections */}
        {filtered.map((section) => {
          const isOpen = q ? true : openSections.has(section.id);
          return (
            <div key={section.id} className="overflow-hidden rounded-xl border border-border bg-card">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{section.title}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {/* Items */}
              {isOpen && (
                <div className="divide-y divide-border border-t border-border">
                  {section.items.map((item) => {
                    const itemOpen = q ? true : openItems.has(item.id);
                    return (
                      <div key={item.id}>
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30"
                        >
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          {itemOpen ? (
                            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-ocean" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                        {itemOpen && (
                          <div className="px-4 pb-4">
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {item.content}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          MagellAIn {helpContent.meta.version} · {helpContent.meta.tagline}
        </p>
      </div>
    </div>
  );
}
