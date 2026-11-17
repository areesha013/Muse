// "Ready to launch?" list for the admin dashboard. Looks at things the owner must change.
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/config/site";
import { emailEnabled, siteUrl } from "@/lib/email";
import { turnstileEnabled } from "@/lib/turnstile";

export type LaunchItem = {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  required: boolean; // false = recommended
  href?: string;
};

const PLACEHOLDER = /your name|your bank|03xx|0000000000|xxxx/i;
export const PLACEHOLDER_WHATSAPP = "923000000000";

type Methods = Record<string, Record<string, unknown> & { enabled?: boolean }>;

/** True when an enabled payment method still has sample text, or no method is on at all. */
export function paymentsNeedWork(payments: unknown): boolean {
  const p = (payments ?? {}) as Methods;
  const enabled = Object.entries(p).filter(([, v]) => v && v.enabled);
  if (enabled.length === 0) return true;
  return enabled.some(([k, v]) => {
    if (k === "cod") return false;
    return PLACEHOLDER.test(Object.values(v).filter((x) => typeof x === "string").join(" "));
  });
}

export async function getLaunchChecklist(db: SupabaseClient): Promise<LaunchItem[]> {
  const [{ data: pay }, { count: realPhotos }] = await Promise.all([
    db.from("settings").select("value").eq("key", "payments").maybeSingle(),
    db.from("product_images").select("id", { count: "exact", head: true }).neq("url", "/placeholder.svg"),
  ]);

  const host = (() => {
    try {
      return new URL(siteUrl()).hostname;
    } catch {
      return "localhost";
    }
  })();

  return [
    {
      id: "payments",
      label: "Real payment details",
      hint: "Replace \"Your Name\" and sample numbers, or turn that method off.",
      done: !paymentsNeedWork(pay?.value),
      required: true,
      href: "/admin/settings",
    },
    {
      id: "photos",
      label: "Product photos added",
      hint: "At least one product needs a real photo.",
      done: (realPhotos ?? 0) > 0,
      required: true,
      href: "/admin/products",
    },
    {
      id: "whatsapp",
      label: "Your WhatsApp number",
      hint: "Set whatsappNumber in src/config/site.ts.",
      done: siteConfig.whatsappNumber !== PLACEHOLDER_WHATSAPP,
      required: true,
    },
    {
      id: "url",
      label: "Real website address",
      hint: "Set NEXT_PUBLIC_SITE_URL to your live address (not localhost).",
      done: host !== "localhost" && host !== "127.0.0.1",
      required: true,
    },
    {
      id: "email",
      label: "Order emails",
      hint: "Add RESEND_API_KEY and OWNER_EMAIL so you get alerts.",
      done: emailEnabled() && Boolean(process.env.OWNER_EMAIL),
      required: false,
    },
    {
      id: "turnstile",
      label: "Spam protection (Turnstile)",
      hint: "Add both Turnstile keys.",
      done: turnstileEnabled(),
      required: false,
    },
  ];
}
