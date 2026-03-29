// ============================================================
// Admin configuration — single source of truth for admin emails.
// Override via ADMIN_EMAILS env var (JSON array of strings).
// Example: ADMIN_EMAILS='["user@example.com","other@example.com"]'
// ============================================================

const DEFAULT_ADMIN_EMAILS = ["mattcsaki@gmail.com"];

function loadAdminEmails(): string[] {
  const envValue = process.env.ADMIN_EMAILS;
  if (!envValue) return DEFAULT_ADMIN_EMAILS;
  try {
    const parsed = JSON.parse(envValue);
    if (Array.isArray(parsed) && parsed.every((e) => typeof e === "string")) {
      return parsed;
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_ADMIN_EMAILS;
}

export const ADMIN_EMAILS = loadAdminEmails();

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}
