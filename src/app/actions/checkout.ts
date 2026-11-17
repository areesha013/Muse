"use server";

import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { normalizePkPhone } from "@/lib/phone";
import { ERROR_FIELD, friendlyError, parseDbError, type PaymentMethod } from "@/lib/orders";
import { emailOrderPlaced } from "@/lib/order-emails";
import { verifyTurnstile } from "@/lib/turnstile";

const cartItem = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(99),
});
const cartItems = z.array(cartItem).min(1).max(50);

export type QuoteLine = {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
  stock: number | null;
  problem: "UNAVAILABLE" | "CHOOSE_OPTION" | "BAD_QUANTITY" | "OUT_OF_STOCK" | null;
};

export type Quote =
  | {
      ok: true;
      lines: QuoteLine[];
      subtotal: number;
      discountAmount: number;
      discountValid: boolean | null;
      discountMessage: string | null;
      shippingFee: number;
      total: number;
    }
  | { ok: false; message: string };

const toDb = (items: z.infer<typeof cartItems>) =>
  items.map((i) => ({ product_id: i.productId, variant_id: i.variantId, quantity: i.quantity }));

const hasServerKeys = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Live prices, stock, discount and shipping for the checkout page.
export async function quoteCart(input: {
  items: { productId: string; variantId: string | null; quantity: number }[];
  city: string;
  code: string;
}): Promise<Quote> {
  const parsed = cartItems.safeParse(input.items);
  if (!parsed.success) return { ok: false, message: "Your cart has an item we can't read. Please clear it and try again." };
  if (!hasServerKeys()) return { ok: false, message: "Checkout isn't available right now. Please try again later." };

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("quote_cart", {
      p_items: toDb(parsed.data),
      p_city: String(input.city ?? "").slice(0, 80),
      p_code: String(input.code ?? "").slice(0, 40),
    });
    if (error) {
      const { code, detail } = parseDbError(error.message);
      console.error("[quote]", error.message);
      return { ok: false, message: friendlyError(code, detail) };
    }
    const q = data as {
      lines: {
        product_id: string; variant_id: string | null; name: string; variant_name: string | null;
        unit_price: number; quantity: number; stock: number | null; problem: QuoteLine["problem"];
      }[];
      subtotal: number; discount_amount: number; discount_valid: boolean | null; discount_message: string | null;
      shipping_fee: number; total: number;
    };
    return {
      ok: true,
      lines: q.lines.map((l) => ({
        productId: l.product_id,
        variantId: l.variant_id,
        name: l.name,
        variantName: l.variant_name,
        unitPrice: Number(l.unit_price),
        quantity: l.quantity,
        stock: l.stock,
        problem: l.problem,
      })),
      subtotal: Number(q.subtotal),
      discountAmount: Number(q.discount_amount),
      discountValid: q.discount_valid,
      discountMessage: q.discount_message,
      shippingFee: Number(q.shipping_fee),
      total: Number(q.total),
    };
  } catch (e) {
    console.error("[quote] failed:", e);
    return { ok: false, message: "We couldn't update your totals. Please try again." };
  }
}

const orderSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  phone: z
    .string()
    .transform((v) => normalizePkPhone(v))
    .refine((v): v is string => v !== null, "Please enter a valid mobile number, like 0300 1234567."),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Please enter a valid email address."),
  city: z.string().trim().min(2, "Please enter your city.").max(60),
  address: z.string().trim().min(5, "Please enter your full delivery address.").max(300),
  notes: z.string().trim().max(500),
  method: z.enum(["cod", "jazzcash", "easypaisa", "bank_transfer"]),
  code: z.string().trim().max(40),
  items: cartItems,
  website: z.string().max(200).optional(), // spam trap
  captcha: z.string().max(2048).optional(), // Cloudflare Turnstile token
});

export type PlaceOrderResult =
  | { ok: true; token: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;

  // Spam bots fill the hidden field. Pretend it worked, save nothing.
  if (d.website) return { ok: false, message: "Something went wrong. Please try again." };

  if (!hasServerKeys()) return { ok: false, message: "Ordering isn't available right now. Please try again later." };

  const captcha = await verifyTurnstile(d.captcha);
  if (!captcha.ok) return { ok: false, message: captcha.message };

  // Link the order to the account if the customer is logged in (guests are fine too).
  let userId: string | null = null;
  try {
    const { data } = await createClient().auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("create_order", {
      p_user_id: userId,
      p_name: d.name,
      p_email: d.email || null,
      p_phone: d.phone,
      p_city: d.city,
      p_address: d.address,
      p_notes: d.notes || null,
      p_method: d.method as PaymentMethod,
      p_items: toDb(d.items),
      p_code: d.code,
    });

    if (error) {
      const { code, detail } = parseDbError(error.message);
      if (code === "UNKNOWN") console.error("[order]", error.message);
      const field = ERROR_FIELD[code];
      return {
        ok: false,
        message: friendlyError(code, detail),
        ...(field ? { fieldErrors: { [field]: friendlyError(code, detail) } } : {}),
      };
    }
    const created = data as { access_token: string; order_id: string; order_number: string; total: number | string };
    await emailOrderPlaced({
      orderId: created.order_id,
      orderNumber: created.order_number,
      total: Number(created.total),
      token: created.access_token,
      method: d.method as PaymentMethod,
      name: d.name,
      phone: d.phone,
      email: d.email || null,
    });
    return { ok: true, token: created.access_token };
  } catch (e) {
    console.error("[order] failed:", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
