"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbMessage, getAdminContext, NOT_ADMIN, type ActionResult } from "@/lib/admin";
import { parseMoney } from "@/lib/slug";

const uuid = z.string().uuid();

const inputSchema = z.object({
  id: z.string().uuid().nullable(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/, "The code needs 3 to 24 letters or numbers. No spaces."),
  type: z.enum(["percentage", "fixed"]),
  value: z.string(),
  min_order: z.string(),
  max_uses: z.string(),
  expires_on: z.string(), // yyyy-mm-dd or ""
  is_active: z.boolean(),
});
export type DiscountInput = z.input<typeof inputSchema>;

export async function saveDiscount(input: DiscountInput): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = parsed.data;

  const value = parseMoney(d.value);
  if (value === null || value <= 0) return { ok: false, message: "Enter the discount as a number bigger than 0." };
  if (d.type === "percentage" && value > 100) return { ok: false, message: "A percentage cannot be more than 100." };
  const minOrder = d.min_order.trim() === "" ? 0 : parseMoney(d.min_order);
  if (minOrder === null) return { ok: false, message: "Minimum order must be a number (or empty)." };
  let maxUses: number | null = null;
  if (d.max_uses.trim() !== "") {
    if (!/^\d{1,7}$/.test(d.max_uses.trim()) || Number(d.max_uses) < 1) return { ok: false, message: "Maximum uses must be a whole number, 1 or more (or empty for no limit)." };
    maxUses = Number(d.max_uses);
  }
  let expiresAt: string | null = null;
  if (d.expires_on.trim() !== "") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.expires_on) || Number.isNaN(Date.parse(d.expires_on))) return { ok: false, message: "Please pick a valid end date." };
    expiresAt = `${d.expires_on}T23:59:59+05:00`; // the whole last day counts (Pakistan time)
  }

  const row = { code: d.code, type: d.type, value, min_order: minOrder, max_uses: maxUses, expires_at: expiresAt, is_active: d.is_active };
  const { error } = d.id
    ? await ctx.supabase.from("discount_codes").update(row).eq("id", d.id)
    : await ctx.supabase.from("discount_codes").insert(row);
  if (error) {
    if (error.message.toLowerCase().includes("duplicate key")) return { ok: false, message: "That code already exists. Pick another one." };
    if (error.message.includes("discount_codes_format")) return { ok: false, message: "Use only letters, numbers, - and _ in the code." };
    return { ok: false, message: dbMessage(error) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: d.id ? "Saved." : "Code created." };
}

export async function deleteDiscount(id: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  if (!uuid.safeParse(id).success) return { ok: false, message: "That request was not valid." };
  const { error } = await ctx.supabase.from("discount_codes").delete().eq("id", id);
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Code deleted." };
}
