"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbMessage, getAdminContext, NOT_ADMIN, type ActionResult } from "@/lib/admin";

// Settings are public (the checkout page and footer read them). Never put secrets in them.

async function saveSetting(key: string, value: unknown): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const { error } = await ctx.supabase.from("settings").upsert({ key, value }, { onConflict: "key" });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. The shop uses the new settings now." };
}

const text = (max: number) => z.string().trim().max(max, `That is too long (${max} characters max).`);

// ---------- Store info ----------
const storeSchema = z.object({
  name: z.string().trim().min(1, "Please enter the shop name.").max(60),
  email: text(120).refine((v) => v === "" || z.string().email().safeParse(v).success, "That email address does not look right."),
  phone: text(20),
  address: text(200),
  instagram: text(200).refine((v) => v === "" || /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._\/-]+\/?$/.test(v), "Use the full link, like https://instagram.com/yourname"),
});
export type StoreSettingsInput = z.input<typeof storeSchema>;

export async function saveStoreSettings(input: StoreSettingsInput): Promise<ActionResult> {
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return saveSetting("store", parsed.data);
}

// ---------- Shipping ----------
const rate = z.number().finite().min(0, "Shipping cannot be negative.").max(100_000, "That shipping amount is too high.");
const shippingSchema = z.object({
  flat_rate: rate,
  free_shipping_over: z.number().finite().min(0).max(10_000_000).nullable(),
  use_city_rates: z.boolean(),
  city_rates: z.array(z.object({ city: z.string().trim().min(1).max(60), rate })).max(60),
  other_city_rate: rate,
});
export type ShippingSettingsInput = z.input<typeof shippingSchema>;

export async function saveShippingSettings(input: ShippingSettingsInput): Promise<ActionResult> {
  const parsed = shippingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  const city_rates: Record<string, number> = {};
  for (const c of v.city_rates) city_rates[c.city] = c.rate;
  return saveSetting("shipping", {
    flat_rate: v.flat_rate,
    free_shipping_over: v.free_shipping_over && v.free_shipping_over > 0 ? v.free_shipping_over : null,
    use_city_rates: v.use_city_rates,
    city_rates,
    other_city_rate: v.other_city_rate,
  });
}

// ---------- Payment methods ----------
const wallet = z.object({ enabled: z.boolean(), account_title: text(80), number: text(30) });
const paymentsSchema = z.object({
  cod: z.object({ enabled: z.boolean() }),
  jazzcash: wallet,
  easypaisa: wallet,
  bank_transfer: z.object({ enabled: z.boolean(), bank_name: text(80), account_title: text(80), account_number: text(40), iban: text(40) }),
});
export type PaymentSettingsInput = z.input<typeof paymentsSchema>;

export async function savePaymentSettings(input: PaymentSettingsInput): Promise<ActionResult> {
  const parsed = paymentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  if (!v.cod.enabled && !v.jazzcash.enabled && !v.easypaisa.enabled && !v.bank_transfer.enabled) {
    return { ok: false, message: "Keep at least one payment method on, or customers cannot check out." };
  }
  for (const [label, w] of [["JazzCash", v.jazzcash], ["Easypaisa", v.easypaisa]] as const) {
    if (w.enabled && (!w.account_title || !w.number)) return { ok: false, message: `${label} is on, so please fill in the account name and number.` };
  }
  const b = v.bank_transfer;
  if (b.enabled && (!b.bank_name || !b.account_title || (!b.account_number && !b.iban))) {
    return { ok: false, message: "Bank transfer is on, so please fill in the bank, account name and account number or IBAN." };
  }
  return saveSetting("payments", v);
}
