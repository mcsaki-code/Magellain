"use client";

import { useState, useEffect } from "react";
import { Bell, Download, X, Share, Plus } from "lucide-react";
import {
  notificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications/notification-manager";
import { trackEvent } from "@/lib/telemetry/tracker";

/**
 * Detects whether the app is running as an installed PWA (home screen).
 */
function isRunningAsPWA(): boolean {
  if (typeof window === "undefined") return false;
  // iOS: navigator.standalone is true when launched from home screen
  if ("standalone" in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone) return true;
  // Android/desktop: display-mode: standalone media query
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}

/**
 * Detects iOS Safari specifically.
 */
function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

/**
 * Smart prompt that adapts based on context:
 * - If running in browser (not installed): shows "Add to Home Screen" instructions
 * - If running as PWA + notifications not yet granted: shows notification opt-in
 * - If already installed + notifications granted/denied: shows nothing
 */
export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"install" | "notify">("install");
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("magellain-prompt-dismissed");
    if (dismissed) return;

    const timer = setTimeout(() => {
      if (isRunningAsPWA()) {
        // Already installed — check if we should prompt for notifications
        if (notificationsSupported()) {
          const perm = getNotificationPermission();
          if (perm === "default") {
            setMode("notify");
            setShow(true);
          }
        }
      } else {
        // Not installed as PWA — suggest adding to home screen
        setMode("install");
        setShow(true);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleNotifyEnable = async () => {
    const result = await requestNotificationPermission();
    setShow(false);
    sessionStorage.setItem("magellain-prompt-dismissed", "true");
    trackEvent("notification_permission", { result });
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("magellain-prompt-dismissed", "true");
    trackEvent("install_prompt_dismissed", { mode });
  };

  if (!show) return null;

  // ── Notification opt-in (PWA is installed) ─────────────────
  if (mode === "notify") {
    return (
      <div className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-ocean/20 bg-ocean/5 p-3 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="rounded-lg bg-ocean/10 p-2">
          <Bell className="h-4 w-4 text-ocean" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Weather alerts</p>
          <p className="text-[10px] text-muted-foreground">
            Get notified about Small Craft Advisories and severe weather
          </p>
        </div>
        <button
          onClick={handleNotifyEnable}
          className="shrink-0 rounded-lg bg-ocean px-3 py-1.5 text-xs font-medium text-white hover:bg-ocean-600"
        >
          Enable
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // ── Add to Home Screen prompt (not installed) ──────────────
  return (
    <div className="mx-4 mb-2 rounded-xl border border-ocean/20 bg-ocean/5 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3 p-3">
        <div className="rounded-lg bg-ocean/10 p-2">
          <Download className="h-4 w-4 text-ocean" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">
            Add MagellAIn to your home screen
          </p>
          <p className="text-[10px] text-muted-foreground">
            For the best experience — works like an app, even offline
          </p>
        </div>
        <button
          onClick={() => {
            setShowInstructions(!showInstructions);
            trackEvent("install_prompt_howto", { platform: isIOSSafari() ? "ios" : "other" });
          }}
          className="shrink-0 rounded-lg bg-ocean px-3 py-1.5 text-xs font-medium text-white hover:bg-ocean-600"
        >
          How
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Step-by-step instructions */}
      {showInstructions && (
        <div className="border-t border-ocean/10 px-4 py-3 space-y-2.5 animate-in fade-in duration-200">
          {isIOSSafari() ? (
            <>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ocean text-[10px] font-bold text-white">1</span>
                <p className="text-xs text-foreground">
                  Tap the <Share className="inline h-3.5 w-3.5 text-ocean" /> <strong>Share</strong> button at the bottom of your screen
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ocean text-[10px] font-bold text-white">2</span>
                <p className="text-xs text-foreground">
                  Scroll down and tap <Plus className="inline h-3.5 w-3.5 text-ocean" /> <strong>Add to Home Screen</strong>
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ocean text-[10px] font-bold text-white">3</span>
                <p className="text-xs text-foreground">
                  Tap <strong>Add</strong> in the top right corner
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ocean text-[10px] font-bold text-white">1</span>
                <p className="text-xs text-foreground">
                  Tap the <strong>menu icon</strong> (three dots) in your browser
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ocean text-[10px] font-bold text-white">2</span>
                <p className="text-xs text-foreground">
                  Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ocean text-[10px] font-bold text-white">3</span>
                <p className="text-xs text-foreground">
                  Tap <strong>Install</strong> or <strong>Add</strong> to confirm
                </p>
              </div>
            </>
          )}
          <p className="text-[10px] text-muted-foreground pt-1">
            Once installed, MagellAIn will open full-screen from your home screen with offline support and weather alerts.
          </p>
        </div>
      )}
    </div>
  );
}
