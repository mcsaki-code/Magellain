import { Header } from "@/components/layout/header";
import { ArrowLeft, Anchor, Brain, Trophy, Shield, Smartphone, ExternalLink, Database } from "lucide-react";
import Link from "next/link";
import aboutContent from "@/lib/content/about-content.json";

const featureIcons: Record<string, typeof Anchor> = {
  "live-data": Database,
  "ai-coach": Brain,
  "race-management": Trophy,
  "safety": Shield,
  "mobile-first": Smartphone,
};

export default function AboutPage() {
  const { about, features, dataSources, contact, legal } = aboutContent;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="About">
        <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>

      <div className="flex flex-col gap-6 p-4 pb-24">

        {/* Hero */}
        <div className="rounded-xl border border-ocean/30 bg-ocean/10 p-5 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Anchor className="h-6 w-6 text-ocean" />
            <h1 className="text-xl font-bold text-foreground">{about.title}</h1>
          </div>
          <p className="text-sm font-medium text-ocean">{about.subtitle}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{about.description}</p>
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span>v{about.version}</span>
            <span>·</span>
            <span>{about.builtFor}</span>
          </div>
        </div>

        {/* Features */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Features</h2>
          <div className="space-y-2">
            {features.map((feature) => {
              const Icon = featureIcons[feature.id] ?? Anchor;
              return (
                <div key={feature.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2.5">
                    <Icon className="h-5 w-5 text-ocean" />
                    <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.details}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Data Sources */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Data Sources</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {dataSources.map((source) => (
              <div key={source.name} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-ocean" />
                <div>
                  <p className="text-sm font-medium text-foreground">{source.name}</p>
                  <p className="text-xs text-muted-foreground">{source.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contact</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 text-sm text-ocean hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              {contact.email}
            </a>
            <p className="text-xs text-muted-foreground">
              Serving: {contact.clubs.join(", ")}
            </p>
          </div>
        </section>

        {/* Legal / Disclaimer */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Safety Disclaimer</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">{legal.disclaimer}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{legal.dataAttribution}</p>
          </div>
        </section>

      </div>
    </div>
  );
}
