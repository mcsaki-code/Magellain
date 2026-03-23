import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-navy px-4 py-8">
      {/* Back button */}
      <div className="mb-4">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-navy-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-8 text-center">
          <span className="text-3xl font-bold tracking-tight">
            <span className="text-white">Magell</span>
            <span className="text-ocean">AI</span>
            <span className="text-white">n</span>
          </span>
          <p className="mt-2 text-sm text-navy-300">
            Navigate Smarter. Race Harder.
          </p>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
