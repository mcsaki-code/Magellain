"use client";

/**
 * Notification Manager — handles push notification permission and local notifications
 * for weather alerts. This is the prep/foundation layer; full push subscription
 * to a backend push service can be added in a future sprint.
 */

// Check if notifications are supported
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

// Get current permission state
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "denied";
  }
}

// Show a local notification (works without a push server)
export function showLocalNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    requireInteraction?: boolean;
  }
): boolean {
  if (!notificationsSupported() || Notification.permission !== "granted") {
    return false;
  }

  try {
    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || "/icons/icon-192x192.png",
      tag: options?.tag || "magellain-alert",
      requireInteraction: options?.requireInteraction || false,
    });

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch {
    return false;
  }
}

// Weather alert severity levels
export type AlertSeverity = "advisory" | "warning" | "watch";

export interface WeatherAlert {
  type: string;
  severity: AlertSeverity;
  headline: string;
  description: string;
  expires: string;
}

// Show weather alert as a notification
export function notifyWeatherAlert(alert: WeatherAlert): boolean {
  const prefix = alert.severity === "warning" ? "WARNING" : alert.severity === "advisory" ? "ADVISORY" : "WATCH";
  return showLocalNotification(
    `${prefix}: ${alert.type}`,
    {
      body: alert.headline,
      tag: `weather-${alert.type.replace(/\s+/g, "-").toLowerCase()}`,
      requireInteraction: alert.severity === "warning",
    }
  );
}

// Track which alerts we have already notified about (session-level dedup)
const notifiedAlerts = new Set<string>();

export function shouldNotifyAlert(alertId: string): boolean {
  if (notifiedAlerts.has(alertId)) return false;
  notifiedAlerts.add(alertId);
  return true;
}
