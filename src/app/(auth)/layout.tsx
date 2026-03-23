import { Wordmark } from "@/components/layout/header";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-navy px-4 py-8">
      <div className="mb-8 text-center">
        <Wordmark className="text-3xl" />
        <p className="mt-2 text-sm text-navy-300">
          Navigate Smarter. Race Harder.
        </p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
