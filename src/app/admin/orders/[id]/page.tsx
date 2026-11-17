import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD_LABEL, type OrderStatus, type PaymentMethod, type PaymentStatus } from "@/lib/orders";
import { toWhatsAppNumber } from "@/lib/phone";
import { formatPKR } from "@/lib/utils";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status-badge";
import { OrderActions } from "@/components/admin/order-actions";
import { PaymentReview } from "@/components/admin/payment-review";

export const metadata: Metadata = { title: "Order" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Order = {
  id: string; order_number: string; status: OrderStatus; payment_method: PaymentMethod;
  customer_name: string; customer_email: string | null; customer_phone: string;
  shipping_city: string; shipping_address: string; notes: string | null;
  subtotal: number; discount_amount: number; shipping_fee: number; total: number;
  discount_code: string | null; tracking_note: string | null; created_at: string; access_token: string;
};
type Payment = {
  status: PaymentStatus; amount: number; sender_name: string | null; transaction_id: string | null;
  receipt_path: string | null; admin_note: string | null; verified_at: string | null;
};

export default async function OrderDetail({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const supabase = createClient();

  const { data: order } = await supabase.from("orders").select("*").eq("id", params.id).maybeSingle();
  if (!order) notFound();
  const o = order as Order;

  const [{ data: items }, { data: pay }] = await Promise.all([
    supabase.from("order_items").select("product_name, variant_name, unit_price, quantity, line_total").eq("order_id", o.id).order("product_name"),
    supabase.from("payments").select("status, amount, sender_name, transaction_id, receipt_path, admin_note, verified_at").eq("order_id", o.id).maybeSingle(),
  ]);
  const p = pay as Payment | null;

  // Receipts are private. A short-lived link (5 minutes) is made for the admin only.
  let receiptUrl: string | null = null;
  if (p?.receipt_path) {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(p.receipt_path, 300);
    receiptUrl = data?.signedUrl ?? null;
  }

  const wa = toWhatsAppNumber(o.customer_phone);
  const waText = encodeURIComponent(`Hi ${o.customer_name.split(" ")[0]}, this is MUSE about your order ${o.order_number}.`);

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-neutral-700 hover:underline">
        <ArrowLeft size={14} aria-hidden /> All orders
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{o.order_number}</h1>
        <OrderStatusBadge status={o.status} />
        <span className="text-sm text-neutral-600">
          {new Date(o.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" })}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section aria-labelledby="items-h" className="rounded-2xl border border-neutral-200 p-5">
            <h2 id="items-h" className="font-semibold">Items</h2>
            <ul className="mt-3 divide-y divide-neutral-100">
              {(items ?? []).map((it, i) => (
                <li key={i} className="flex justify-between gap-4 py-2 text-sm">
                  <span>
                    {it.product_name}{it.variant_name ? `, ${it.variant_name}` : ""}
                    <span className="block text-neutral-600">{formatPKR(Number(it.unit_price))} × {it.quantity}</span>
                  </span>
                  <span className="font-medium">{formatPKR(Number(it.line_total))}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-600">Subtotal</dt><dd>{formatPKR(Number(o.subtotal))}</dd></div>
              {Number(o.discount_amount) > 0 && (
                <div className="flex justify-between"><dt className="text-neutral-600">Discount{o.discount_code ? ` (${o.discount_code})` : ""}</dt><dd>-{formatPKR(Number(o.discount_amount))}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-neutral-600">Shipping</dt><dd>{Number(o.shipping_fee) > 0 ? formatPKR(Number(o.shipping_fee)) : "Free"}</dd></div>
              <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatPKR(Number(o.total))}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="cust-h" className="rounded-2xl border border-neutral-200 p-5">
            <h2 id="cust-h" className="font-semibold">Customer and delivery</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">Name</dt><dd className="text-right">{o.customer_name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">Phone</dt><dd className="text-right">{o.customer_phone}</dd></div>
              {o.customer_email && <div className="flex justify-between gap-4"><dt className="text-neutral-600">Email</dt><dd className="break-all text-right">{o.customer_email}</dd></div>}
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">City</dt><dd className="text-right">{o.shipping_city}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">Address</dt><dd className="whitespace-pre-line text-right">{o.shipping_address}</dd></div>
              {o.notes && <div className="flex justify-between gap-4"><dt className="text-neutral-600">Customer note</dt><dd className="whitespace-pre-line text-right">{o.notes}</dd></div>}
            </dl>
            {wa && (
              <a href={`https://wa.me/${wa}?text=${waText}`} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-900 px-5 py-2 text-sm font-medium hover:bg-neutral-100">
                <MessageCircle size={16} aria-hidden /> Message on WhatsApp
              </a>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="pay-h" className="rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="pay-h" className="font-semibold">Payment</h2>
              {p && <PaymentStatusBadge status={p.status} long />}
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">Method</dt><dd>{PAYMENT_METHOD_LABEL[o.payment_method]}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-600">Amount</dt><dd className="font-medium">{formatPKR(Number(p?.amount ?? o.total))}</dd></div>
              {p?.sender_name && <div className="flex justify-between gap-4"><dt className="text-neutral-600">Sender name</dt><dd className="text-right">{p.sender_name}</dd></div>}
              {p?.transaction_id && <div className="flex justify-between gap-4"><dt className="text-neutral-600">Transaction ID</dt><dd className="break-all text-right font-medium">{p.transaction_id}</dd></div>}
              {p?.admin_note && <div className="flex justify-between gap-4"><dt className="text-neutral-600">Your note</dt><dd className="text-right">{p.admin_note}</dd></div>}
            </dl>

            {o.payment_method === "cod" ? (
              <p className="mt-3 text-sm text-neutral-600">Cash on delivery. It is marked paid when you mark the order as delivered.</p>
            ) : (
              <>
                {p?.receipt_path && (
                  <div className="mt-4">
                    {receiptUrl ? (
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={receiptUrl} alt="Payment receipt uploaded by the customer" className="max-h-80 w-full rounded-xl border border-neutral-200 object-contain" />
                        <span className="mt-1 block text-xs text-neutral-600 underline">Open full size (link works for 5 minutes)</span>
                      </a>
                    ) : (
                      <p className="text-sm text-red-700">Could not open the receipt. Refresh the page.</p>
                    )}
                  </div>
                )}
                {!p?.receipt_path && !p?.transaction_id && o.status === "pending_payment" && (
                  <p className="mt-3 text-sm text-neutral-600">No proof yet. If the customer told you on WhatsApp that they paid, check your account, then verify.</p>
                )}
                <PaymentReview orderId={o.id} paymentStatus={p?.status ?? "pending"} orderStatus={o.status} />
              </>
            )}
          </section>

          <OrderActions orderId={o.id} status={o.status} trackingNote={o.tracking_note} />

          <p className="text-xs text-neutral-600">
            Customer&apos;s private order page:{" "}
            <Link href={`/order/${o.access_token}`} target="_blank" className="underline">open</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
