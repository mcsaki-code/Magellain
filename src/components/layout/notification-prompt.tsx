"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, X } from "lucide-react";
import {
  notificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications/notification-manager";
import { trackEvent } from "@/lib/telemetry/tracker";

/**
 * Non-intrusive notification opt-in banner.
 * Shows once per session if notifications haven't been granted or denied.
 * Placed in the main layout or home page.
 */
export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if (!notificationsSupported()) return;

    const perm = getNotificationPermission();
    setPermission(perm);

    // Only show prompt if permission is "default" (not yet asked)
    // and user hasn't dismissed it this session
    if (perm === "default") {
      const dismissed = sessionStorage.getItem("magellain-notif-dismissed");
      if (!dismissed) {
        // Delay showing by 5 seconds so it doesn't disrupt initial load
        const timer = setTimeout(() => setShow(true), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleEnable = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    setShow(false);
    trackEvent("notification_permission", { result });
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("magellain-notif-dismissed", "true");
    trackEvent("notification_prompt_dismissed");
  };

  if (!show || permission !== "default") return null;

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
        onClick={handleEnable}
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
