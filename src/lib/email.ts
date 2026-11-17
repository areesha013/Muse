// Optional emails through Resend (https://resend.com). If RESEND_API_KEY is not set,
// every function here quietly does nothing, so the shop works fine without emails.
//
// Settings (.env.local / Vercel):
//   RESEND_API_KEY   your Resend key
//   OWNER_EMAIL      where YOU get alerts (new order, payment proof, review, custom request)
//   EMAIL_FROM       e.g. "MUSE <orders@yourdomain.com>" (needs a domain verified in Resend).
//                    Without it we use Resend's test sender, which only delivers to the
//                    email you signed up to Resend with. Fine for owner alerts while testing.
import { siteConfig } from "@/config/site";

const TIMEOUT_MS = 5000;
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function isEmail(v: string | null | undefined): v is string {
  return !!v && v.length <= 254 && EMAIL_RE.test(v);
}

// Never throws and never waits more than a few seconds: an email problem must not break an order.
export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!emailEnabled() || !isEmail(opts.to)) return false;
  const base = process.env.RESEND_API_URL || "https://api.resend.com";
  const from = process.env.EMAIL_FROM || `${siteConfig.name} <onboarding@resend.dev>`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject.replace(/[\r\n]+/g, " ").slice(0, 150),
        text: `${opts.text}\n\n-- \n${siteConfig.name}`,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[email] Resend said", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] failed:", e instanceof Error ? e.message : e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyOwner(subject: string, text: string): Promise<void> {
  const to = process.env.OWNER_EMAIL;
  if (!to) return;
  await sendEmail({ to, subject: `[${siteConfig.name}] ${subject}`, text });
}

export const rs = (n: number | string) => `Rs ${Number(n).toLocaleString("en-PK")}`;
