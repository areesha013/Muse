"use server";

import { z } from "zod";
import { dbMessage, getAdminContext, NOT_ADMIN, type ActionResult } from "@/lib/admin";
import { emailOrderUpdate } from "@/lib/order-emails";
import { emailEnabled } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
// Looks the order up (as the logged-in admin) so we can email the customer. Best effort only.
async function mailCustomer(supabase: ReturnType<typeof createClient>, orderId: string, update: Parameters<typeof emailOrderUpdate>[1]) {
  if (!emailEnabled()) return;
  try {
    const { data } = await supabase.from("orders").select("order_number, customer_name, customer_email, access_token").eq("id", orderId).maybeSingle();
    if (!data) return;
    await emailOrderUpdate({ orderNumber: data.order_number as string, token: data.access_token as string, name: data.customer_name as string, email: (data.customer_email as string | null) ?? null }, update);
  } catch (e) {
    console.error("[email] order update:", e);
  }
}

const statuses = z.enum(["confirmed", "packed", "shipped", "delivered", "cancelled"]);

export async function setOrderStatus(orderId: string, status: string, note: string | null): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(orderId);
  const st = statuses.safeParse(status);
  if (!id.success || !st.success) return { ok: false, message: "That request was not valid." };
  const cleanNote = note === null ? null : note.trim().slice(0, 500);

  const { data, error } = await ctx.supabase.rpc("admin_set_order_status", {
    p_order_id: id.data,
    p_status: st.data,
    p_note: cleanNote,
  });
  if (error) return { ok: false, message: dbMessage(error) };
  const refund = (data as { refund_needed?: boolean } | null)?.refund_needed;
  await mailCustomer(ctx.supabase, id.data, { kind: "status", status: st.data, note: cleanNote });
  return {
    ok: true,
    message: refund
      ? "Order cancelled and stock returned. The customer already paid, so please refund them yourself."
      : st.data === "cancelled"
        ? "Order cancelled and stock returned."
        : "Order updated.",
  };
}

// Saves only the note the customer sees (keeps the status the same).
export async function saveTrackingNote(orderId: string, currentStatus: string, note: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(orderId);
  if (!id.success) return { ok: false, message: "That request was not valid." };
  const { data: order } = await ctx.supabase.from("orders").select("status").eq("id", id.data).maybeSingle();
  if (!order) return { ok: false, message: "Order not found." };
  const { error } = await ctx.supabase.rpc("admin_set_order_status", {
    p_order_id: id.data,
    p_status: order.status,
    p_note: note.trim().slice(0, 500),
  });
  if (error) return { ok: false, message: dbMessage(error) };
  return { ok: true, message: "Note saved. The customer sees it on their tracking page." };
}

export async function reviewPayment(orderId: string, action: string, note: string): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return NOT_ADMIN;
  const id = uuid.safeParse(orderId);
  const act = z.enum(["verify", "reject"]).safeParse(action);
  if (!id.success || !act.success) return { ok: false, message: "That request was not valid." };

  const { error } = await ctx.supabase.rpc("admin_review_payment", {
    p_order_id: id.data,
    p_action: act.data,
    p_note: note.trim().slice(0, 300) || null,
  });
  if (error) return { ok: false, message: dbMessage(error) };
  await mailCustomer(ctx.supabase, id.data, act.data === "verify" ? { kind: "payment_verified" } : { kind: "payment_rejected", note: note.trim().slice(0, 300) || null });
  return {
    ok: true,
    message: act.data === "verify" ? "Payment verified. The order is now confirmed." : "Payment rejected. The customer can send new proof.",
  };
}
