"use client";

import { createClient } from "@/lib/supabase/client";

// ─── Session ID (persists per browser tab) ───────────────
let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return sessionId;
}

// ─── Debounce to avoid duplicate rapid-fire events ───────
const recentEvents = new Map<string, number>();

function isDuplicate(key: string, windowMs = 2000): boolean {
  const now = Date.now();
  const last = recentEvents.get(key);
  if (last && now - last < windowMs) return true;
  recentEvents.set(key, now);
  // Clean old entries
  if (recentEvents.size > 100) {
    const toDelete: string[] = [];
    recentEvents.forEach((v, k) => {
      if (now - v > 10000) toDelete.push(k);
    });
    toDelete.forEach((k) => recentEvents.delete(k));
  }
  return false;
}

// ─── Track Page View ─────────────────────────────────────
export async function trackPageView(pagePath: string, pageTitle?: string) {
  if (isDuplicate(`pv:${pagePath}`)) return;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("page_views").insert({
      user_id: user?.id ?? null,
      page_path: pagePath,
      page_title: pageTitle || document.title,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      session_id: getSessionId(),
    });
  } catch {
    // Silent fail — telemetry should never break the app
  }
}

// ─── Track Feature Event ─────────────────────────────────
export async function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>,
  pagePath?: string
) {
  if (isDuplicate(`ev:${eventName}:${JSON.stringify(eventData || {})}`)) return;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("feature_events").insert({
      user_id: user?.id ?? null,
      event_name: eventName,
      event_data: eventData || {},
      page_path: pagePath || window.location.pathname,
      session_id: getSessionId(),
    });
  } catch {
    // Silent fail
  }
}
