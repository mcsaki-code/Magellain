import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";

export const metadata: Metadata = {
  title: "MagellAIn - Navigate Smarter. Race Harder.",
  description:
    "Sailing intelligence platform for Great Lakes racing sailors. Live weather, AI coaching, race analytics, and nautical charts.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MagellAIn",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1B2A4A" },
    { media: "(prefers-color-scheme: dark)", color: "#0C1226" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-background">
      <head>
        {/* Blocking script: apply dark class before first paint so iOS safe area
            inherits the correct background color and avoids the white bar flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('magellain-theme');var dark=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(dark?'dark':'light');}catch(e){}})();`,
          }}
        />
        {/* Inject build-time commit SHA into service worker scope for cache busting */}
        <script
          dangerouslySetInnerHTML={{
            __html: `self.__COMMIT_SHA__ = ${JSON.stringify(process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev")};`,
          }}
        />
        {/* Service worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function(err) {
      console.log('[MagellAIn] SW registration failed:', err);
    });
  });
}`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
