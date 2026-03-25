import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground px-6">
      <div className="text-center max-w-md">
        {/* Logo/Wordmark */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            MagellAIn
          </h1>
        </div>

        {/* Heading */}
        <h2 className="text-3xl font-bold mb-4 text-foreground">
          You&apos;re offline
        </h2>

        {/* Message */}
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
          Some features need a connection. Your last loaded data and saved
          tracks are still available.
        </p>

        {/* Link back to home */}
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-ocean text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
