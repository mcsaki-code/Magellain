"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/callback?redirect=/menu/settings`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-navy-400 bg-navy-700 p-6 text-center">
        <h2 className="text-lg font-semibold text-white">Check your email</h2>
        <p className="mt-2 text-sm text-navy-300">
          If an account exists for <strong className="text-white">{email}</strong>,
          you will receive a password reset link.
        </p>
        <Link
          href="/sign-in"
          className="mt-4 inline-block text-sm font-medium text-ocean hover:text-ocean-400"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-navy-200"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="min-h-touch w-full rounded-lg border border-navy-400 bg-navy-700 px-3 py-2.5 text-sm text-white placeholder:text-navy-400 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
          placeholder="you@example.com"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-alert-red/10 px-3 py-2 text-sm text-alert-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-touch w-full items-center justify-center rounded-lg bg-ocean px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ocean-600 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Send Reset Link"
        )}
      </button>

      <p className="text-center text-sm text-navy-400">
        <Link href="/sign-in" className="font-medium text-ocean hover:text-ocean-400">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
