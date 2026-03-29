"use client";

import { useState, useEffect } from "react";
import { Bell, Download, X, Share, Plus } from "lucide-react";
import {
  notificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications/notification-manager";
import { trackEvent } from "@/lib/telemetry/tracker";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function isRunningAsPWA(): boolean {
  if (typeof window === "undefined") return false;
  if ("standalone" in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}

function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription && VAPID_PUBLIC_KEY) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    if (!subscription) return false;

    // Send subscription to our API
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh") as ArrayBuffer))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth") as ArrayBuffer))),
        },
      }),
    });

    return response.ok;
  } catch (err) {
    console.warn("Push subscription failed:", err);
    return false;
  }
}

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"install" | "notify">("install");
  const [showInstructions, setShowInstructions] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("magellain-prompt-dismissed");
    if (dismissed) return;

    const timer = setTimeout(() => {
      if (isRunningAsPWA()) {
        if (notificationsSupported()) {
          const perm = getNotificationPermission();
          if (perm === "default") {
            setMode("notify");
            setShow(true);
          }
        }
      } else {
        setMode("install");
        setShow(true);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleNotifyEnable = async () => {
    setEnabling(true);
    const result = await requestNotificationPermission();
    trackEvent("notification_permission", { result });

    if (result === "granted") {
      // Subscribe to push notifications
      const pushOk = await subscribeToPush();
      trackEvent("push_subscription", { success: pushOk });
    }

    setShow(false);
    sessionStorage.setItem("magellain-prompt-dismissed", "true");
    setEnabling(false);
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("magellain-prompt-dismissed", "true");
    trackEvent("install_prompt_dismissed", { mode });
  };

  if (!show) return null;

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
          disabled={enabling}
          className="shrink-0 rounded-lg bg-ocean px-3 py-1.5 text-xs font-medium text-white hover:bg-ocean-600 disabled:opacity-50"
        >
          {enabling ? "..." : "Enable"}
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
            Once installed, MagellAIn opens full-screen with offline support and weather alert notifications.
          </p>
        </div>
      )}
    </div>
  );
}
