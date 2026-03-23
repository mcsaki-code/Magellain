"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="rounded-xl border border-navy-400 bg-navy-700 p-6 text-center">
        <h2 className="text-lg font-semibold text-white">Check your email</h2>
        <p className="mt-2 text-sm text-navy-300">
          We sent a confirmation link to <strong className="text-white">{email}</strong>.
          Click it to activate your account.
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
    <div className="space-y-6">
      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="mb-1.5 block text-sm font-medium text-navy-200"
          >
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            className="min-h-touch w-full rounded-lg border border-navy-400 bg-navy-700 px-3 py-2.5 text-sm text-white placeholder:text-navy-400 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
            placeholder="Your name"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-navy-200"
          >
            Email
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
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-navy-200"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
            className="min-h-touch w-full rounded-lg border border-navy-400 bg-navy-700 px-3 py-2.5 text-sm text-white placeholder:text-navy-400 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
            placeholder="Min 8 characters"
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
            "Create Account"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-navy-400">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-ocean hover:text-ocean-400">
          Sign in
        </Link>
      </p>
    </div>
  );
}
