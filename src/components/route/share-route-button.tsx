"use client";

import { useState, useCallback } from "react";
import { Share2, Check, Link2 } from "lucide-react";
import { trackEvent } from "@/lib/telemetry/tracker";

interface ShareRouteButtonProps {
  routeId: string;
  routeName: string;
  isPublic: boolean;
  size?: "sm" | "md";
}

export function ShareRouteButton({ routeId, routeName, isPublic, size = "sm" }: ShareRouteButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (!isPublic) return;

    const shareUrl = `${window.location.origin}/route-planner?share=${routeId}`;

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${routeName} — MagellAIn Route`,
          text: `Check out this sailing route on MagellAIn: ${routeName}`,
          url: shareUrl,
        });
        trackEvent("route_share", { routeId, method: "native" });
        return;
      } catch {
        // User cancelled or native share not available — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackEvent("route_share", { routeId, method: "clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [routeId, routeName, isPublic]);

  if (!isPublic) return null;

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const btnClass = size === "sm"
    ? "flex items-center gap-1 rounded-lg px-2 py-1 text-[10px]"
    : "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs";

  return (
    <button
      onClick={handleShare}
      className={`${btnClass} font-medium transition-colors ${
        copied
          ? "bg-alert-green/10 text-alert-green"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
      title={copied ? "Link copied!" : "Share route"}
    >
      {copied ? (
        <>
          <Check className={iconSize} />
          Copied
        </>
      ) : (
        <>
          <Share2 className={iconSize} />
          Share
        </>
      )}
    </button>
  );
}
