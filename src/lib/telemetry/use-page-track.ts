"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "./tracker";

/**
 * Hook: drop into any layout to auto-track page views on route change.
 */
export function usePageTrack() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);
}
