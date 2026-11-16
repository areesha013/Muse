"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

export type NewsletterState = { ok: boolean; message: string } | null;

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export async function subscribeNewsletter(
  _previous: NewsletterState,
  formData: FormData
): Promise<NewsletterState> {
  // Hidden "website" field: real people never fill it, spam bots do.
  if (formData.get("website")) return { ok: true, message: "Thanks for subscribing!" };

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: "Please enter a valid email address." };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: "Sign-up isn't available right now. Please try again later." };
  }

  try {
    const db = createAdminClient();
    const { error } = await db
      .from("newsletter_subscribers")
      .upsert({ email: parsed.data }, { onConflict: "email", ignoreDuplicates: true });
    if (error) {
      console.error("[newsletter]", error.message);
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    return { ok: true, message: "Thanks for subscribing!" };
  } catch (e) {
    console.error("[newsletter] failed:", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
