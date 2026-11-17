"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbMessage, getAdminContext, NOT_ADMIN, type ActionResult } from "@/lib/admin";
import { CUSTOM_STATUSES, CUSTOM_STATUS_LABEL } from "@/lib/custom-order";
import { parseMoney } from "@/lib/slug";
import { isEmail, sendEmail } from "@/lib/email";
import { siteConfig } from "@/config/site";

const uuid = z.string().uuid();

const schema = z.object({
  id: uuid,
  status: z.enum(CUSTOM_STATUSES as [string, ...string[]]),
  quote: z.string(),
  reply: z.string().trim().max(2000, "The reply is too long (2000 letters at most)."),
  emailCustomer: z.boolean().optional(),
});
export type CustomUpdateInput = z.input<typeof schema>;

export async function updateCustomRequest(input: CustomUpdateInput): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = parsed.data;

  let quote: number | null = null;
  if (d.quote.trim()) {
    quote = parseMoney(d.quote);
    if (quote === null || quote > 10_000_000) return { ok: false, message: "The price should be a number, like 2500." };
  }

  const { data: row, error } = await ctx.supabase
    .from("custom_requests")
    .update({ status: d.status, quote_amount: quote, admin_reply: d.reply || null })
    .eq("id", d.id)
    .select("name, email, product_type")
    .maybeSingle();
  if (error) return { ok: false, message: dbMessage(error) };
  if (!row) return { ok: false, message: "Request not found." };

  revalidatePath("/admin/custom");
  let message = "Saved.";
  if (d.emailCustomer) {
    if (!isEmail(row.email as string | null)) message = "Saved. This customer gave no email address, so nothing was emailed. Use WhatsApp.";
    else {
      const sent = await sendEmail({
        to: row.email as string,
        subject: `About your custom request (${siteConfig.name})`,
        text: `Hi ${(row.name as string).split(" ")[0]},\n\nStatus of your request for "${row.product_type}": ${CUSTOM_STATUS_LABEL[d.status as keyof typeof CUSTOM_STATUS_LABEL]}.\n${quote !== null ? `Price: Rs ${quote.toLocaleString("en-PK")}\n` : ""}${d.reply ? `\n${d.reply}\n` : ""}\nReply on WhatsApp: https://wa.me/${siteConfig.whatsappNumber}`,
      });
      message = sent ? "Saved and emailed to the customer." : "Saved. The email could not be sent (is Resend set up?). Use WhatsApp.";
    }
  }
  return { ok: true, message };
}

export async function deleteCustomRequest(id: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  if (!uuid.safeParse(id).success) return { ok: false, message: "That request was not valid." };
  const { data: row } = await ctx.supabase.from("custom_requests").select("reference_images").eq("id", id).maybeSingle();
  const { error } = await ctx.supabase.from("custom_requests").delete().eq("id", id);
  if (error) return { ok: false, message: dbMessage(error) };
  const paths = (row?.reference_images as string[] | null) ?? [];
  if (paths.length) await ctx.supabase.storage.from("custom-requests").remove(paths);
  revalidatePath("/admin/custom");
  return { ok: true, message: "Request deleted." };
}
