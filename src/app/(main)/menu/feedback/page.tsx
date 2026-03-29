"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/telemetry/tracker";
import {
  ArrowLeft, Send, Lightbulb, Bug, HelpCircle, MoreHorizontal,
  CheckCircle2, Loader2
} from "lucide-react";

const categories = [
  { value: "suggestion", label: "Suggestion", icon: Lightbulb, color: "text-ocean" },
  { value: "bug", label: "Bug Report", icon: Bug, color: "text-alert-red" },
  { value: "help", label: "Need Help", icon: HelpCircle, color: "text-alert-yellow" },
  { value: "other", label: "Other", icon: MoreHorizontal, color: "text-muted-foreground" },
] as const;

export default function FeedbackPage() {
  const [category, setCategory] = useState<string>("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
        setEmail(user.email);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError("Please add a subject");
      return;
    }
    if (!message.trim()) {
      setError("Please describe your feedback");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
          email: email.trim() || null,
          page_path: "/menu/feedback",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send");
      }

      setSent(true);
      trackEvent("feedback_submitted", { category });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <Header title="Feedback">
          <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Header>
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-full bg-alert-green/10 p-4">
            <CheckCircle2 className="h-10 w-10 text-alert-green" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Thanks for your feedback!</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            We review every submission and use it to make MagellAIn better for all sailors.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                setSent(false);
                setSubject("");
                setMessage("");
                setCategory("suggestion");
              }}
              className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Send Another
            </button>
            <Link
              href="/menu"
              className="rounded-xl bg-ocean px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ocean-600"
            >
              Back to Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <Header title="Send Feedback">
        <Link href="/menu" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 pb-24">
        {/* Intro */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Have a suggestion, found a bug, or need help? Let us know and we&apos;ll get back to you.
          </p>
        </div>

        {/* Category selector */}
        <div className="grid grid-cols-4 gap-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = category === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                  isActive
                    ? "border-ocean bg-ocean/5"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${isActive ? cat.color : "text-muted-foreground"}`}
                />
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Subject */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your feedback"
            maxLength={200}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
          />
        </div>

        {/* Message */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Details
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us more — steps to reproduce a bug, what you'd like to see, or what you need help with..."
            rows={5}
            maxLength={5000}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean resize-none"
          />
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {message.length}/5000
          </p>
        </div>

        {/* Email */}
        {!userEmail && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Email (optional, for follow-up)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-alert-red">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={sending}
          className="flex items-center justify-center gap-2 rounded-xl bg-ocean px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ocean-600 disabled:opacity-50"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Feedback
            </>
          )}
        </button>
      </form>
    </div>
  );
}
