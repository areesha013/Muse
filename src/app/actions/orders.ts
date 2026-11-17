"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeOrderNumber, normalizePkPhone } from "@/lib/phone";
import {
  MAX_RECEIPT_BYTES,
  friendlyError,
  parseDbError,
  sniffImageType,
  type OrderView,
} from "@/lib/orders";
import { emailPaymentProof } from "@/lib/order-emails";

const hasServerKeys = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// ---------- Track an order by order number + phone ----------
export type TrackState = { ok: true; order: OrderView } | { ok: false; message: string } | null;

export async function trackOrder(_previous: TrackState, formData: FormData): Promise<TrackState> {
  const number = normalizeOrderNumber(String(formData.get("order") ?? ""));
  if (!number) return { ok: false, message: "Please enter your order number, like ORD-1005." };
  const phone = normalizePkPhone(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, message: "Please enter the mobile number you used when ordering." };
  if (!hasServerKeys()) return { ok: false, message: "Tracking isn't available right now. Please try again later." };

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("track_order", { p_number: number, p_phone: phone });
    if (error) {
      console.error("[track]", error.message);
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    if (!data) return { ok: false, message: "We couldn't find an order with those details. Please check and try again." };
    return { ok: true, order: data as OrderView };
  } catch (e) {
    console.error("[track] failed:", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

// ---------- Send proof of payment ----------
export type PaymentState = { ok: boolean; message: string } | null;

const txnSchema = z.string().trim().regex(/^[A-Za-z0-9-]{6,30}$/, "Transaction ID should be 6 to 30 letters or numbers.");
const senderSchema = z.string().trim().min(2, "Please enter the name on the account you paid from.").max(60);

export async function submitPayment(_previous: PaymentState, formData: FormData): Promise<PaymentState> {
  const tokenParsed = z.string().uuid().safeParse(String(formData.get("token") ?? ""));
  if (!tokenParsed.success) return { ok: false, message: "This payment link isn't valid." };
  const token = tokenParsed.data;
  if (!hasServerKeys()) return { ok: false, message: "Payments can't be submitted right now. Please try again later." };

  const db = createAdminClient();

  try {
    const { data: found, error: findError } = await db.rpc("get_order_by_token", { p_token: token });
    if (findError || !found) return { ok: false, message: "We couldn't find this order." };
    const order = found as OrderView;

    if (order.payment_method === "cod") return { ok: false, message: "This is a cash on delivery order. No payment is needed now." };
    if (order.status !== "pending_payment") return { ok: false, message: "This order no longer needs a payment." };
    if (order.payment_status === "verified") return { ok: false, message: "Your payment is already confirmed." };

    // ---- Check the form ----
    const rawSender = String(formData.get("sender_name") ?? "");
    const rawTxn = String(formData.get("transaction_id") ?? "");
    const fileEntry = formData.get("receipt");
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

    let sender: string | null = null;
    let txn: string | null = null;

    if (order.payment_method === "bank_transfer") {
      if (!file) return { ok: false, message: "Please upload a screenshot or photo of your bank transfer receipt." };
      if (rawSender.trim()) {
        const s = senderSchema.safeParse(rawSender);
        if (!s.success) return { ok: false, message: s.error.issues[0].message };
        sender = s.data;
      }
      if (rawTxn.trim()) {
        const t = txnSchema.safeParse(rawTxn);
        if (!t.success) return { ok: false, message: t.error.issues[0].message };
        txn = t.data;
      }
    } else {
      const s = senderSchema.safeParse(rawSender);
      if (!s.success) return { ok: false, message: s.error.issues[0].message };
      const t = txnSchema.safeParse(rawTxn);
      if (!t.success) return { ok: false, message: t.error.issues[0].message };
      sender = s.data;
      txn = t.data;
    }

    // ---- Upload the receipt (private bucket) ----
    let receiptPath: string | null = null;
    if (file) {
      if (file.size > MAX_RECEIPT_BYTES) return { ok: false, message: "That file is too big. Please upload an image under 5 MB." };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = sniffImageType(bytes);
      if (!type) return { ok: false, message: "Please upload a JPG, PNG or WebP image." };

      receiptPath = `${order.order_id}/${randomUUID()}.${type === "jpeg" ? "jpg" : type}`;
      const { error: uploadError } = await db.storage
        .from("receipts")
        .upload(receiptPath, bytes, { contentType: `image/${type}`, upsert: false });
      if (uploadError) {
        console.error("[receipt upload]", uploadError.message);
        return { ok: false, message: "We couldn't upload your receipt. Please try again." };
      }
    }

    // ---- Save ----
    const { data, error } = await db.rpc("submit_payment", {
      p_token: token,
      p_sender_name: sender,
      p_transaction_id: txn,
      p_receipt_path: receiptPath,
    });
    if (error) {
      if (receiptPath) await db.storage.from("receipts").remove([receiptPath]); // don't leave orphan files
      const { code, detail } = parseDbError(error.message);
      if (code === "UNKNOWN") console.error("[payment]", error.message);
      return { ok: false, message: friendlyError(code, detail) };
    }
    await emailPaymentProof({ orderId: order.order_id, orderNumber: order.order_number, method: order.payment_method, name: order.name ?? order.first_name });

    const oldPath = (data as { old_receipt_path: string | null } | null)?.old_receipt_path;
    if (oldPath) await db.storage.from("receipts").remove([oldPath]);

    return { ok: true, message: "Thank you! We've received your payment details and will confirm your order soon." };
  } catch (e) {
    console.error("[payment] failed:", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
