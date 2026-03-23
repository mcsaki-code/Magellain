"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/home";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "apple") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSignIn} className="space-y-4">
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
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-navy-200"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-ocean hover:text-ocean-400"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="min-h-touch w-full rounded-lg border border-navy-400 bg-navy-700 px-3 py-2.5 text-sm text-white placeholder:text-navy-400 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
            placeholder="Your password"
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-navy-600" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-navy px-2 text-navy-400">or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleOAuth("google")}
          className="flex min-h-touch items-center justify-center rounded-lg border border-navy-400 bg-navy-700 px-3 py-2.5 text-sm font-medium text-navy-200 transition-colors hover:bg-navy-600"
        >
          Google
        </button>
        <button
          onClick={() => handleOAuth("apple")}
          className="flex min-h-touch items-center justify-center rounded-lg border border-navy-400 bg-navy-700 px-3 py-2.5 text-sm font-medium text-navy-200 transition-colors hover:bg-navy-600"
        >
          Apple
        </button>
      </div>

      <p className="text-center text-sm text-navy-400">
        No account?{" "}
        <Link href="/sign-up" className="font-medium text-ocean hover:text-ocean-400">
          Create one
        </Link>
      </p>
    </div>
  );
}
