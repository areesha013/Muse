// Cloudflare Turnstile: a free "are you a person?" check that is usually invisible.
// It is ON only when BOTH keys are set. With no keys the site works exactly as before.
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY   public key (shown in the page)
//   TURNSTILE_SECRET_KEY             secret key (server only)
// Not a "use server" file, so it may export normal functions.
import { headers } from "next/headers";

const TIMEOUT_MS = 5000;

export type CaptchaResult = { ok: true } | { ok: false; message: string };

export function turnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

function clientIp(): string | undefined {
  try {
    const h = headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Checks the token the browser got from the Turnstile widget.
 * - Keys not set: always OK.
 * - Cloudflare says "no": blocked.
 * - Cloudflare cannot be reached (down, timeout): let the person through. A Cloudflare
 *   outage should not stop you from taking orders. The hidden trap field and the
 *   per-phone limits still protect you.
 */
export async function verifyTurnstile(token: unknown): Promise<CaptchaResult> {
  if (!turnstileEnabled()) return { ok: true };
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) {
    return { ok: false, message: "Please wait a second for the security check to finish, then try again." };
  }

  const url = process.env.TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  const ip = clientIp();
  if (ip) body.set("remoteip", ip);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "POST", body, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) {
      console.error("[turnstile] verify service answered", res.status, "- letting the request through");
      return { ok: true };
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    console.warn("[turnstile] rejected:", (data["error-codes"] ?? []).join(","));
    return { ok: false, message: "The security check did not pass. Please try again." };
  } catch (e) {
    console.error("[turnstile] could not reach the verify service:", e instanceof Error ? e.message : e);
    return { ok: true };
  } finally {
    clearTimeout(timer);
  }
}
