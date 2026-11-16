import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { getSetting } from "@/lib/catalog";
import { getOrderByToken } from "@/lib/orders-server";
import {
  PAYMENT_METHOD_LABEL,
  type OrderView,
  type PaymentSettings,
} from "@/lib/orders";
import { formatPKR } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { OrderSummary } from "@/components/order-summary";
import { OrderTimeline } from "@/components/order-timeline";
import { PaymentProofForm } from "@/components/payment-proof-form";
import { ShareOrderLink } from "@/components/share-order-link";

// Private page: never cached, never shown in Google.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-neutral-200 py-2 last:border-0">
      <dt className="text-sm text-neutral-600">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <span className="min-w-0 break-all">{value}</span>
        <CopyButton text={value} />
      </dd>
    </div>
  );
}

function PaymentSection({ order, token, settings }: { order: OrderView; token: string; settings: PaymentSettings }) {
  const method = order.payment_method;

  if (method === "cod") {
    return (
      <section aria-labelledby="pay-heading" className="rounded-2xl border border-neutral-200 p-6">
        <h2 id="pay-heading" className="text-lg font-semibold">Payment</h2>
        <p className="mt-2 text-sm text-neutral-700">
          Cash on delivery. Please keep <strong>{formatPKR(order.total)}</strong> ready when your order arrives.
        </p>
      </section>
    );
  }

  const info = settings[method] ?? {};
  const label = PAYMENT_METHOD_LABEL[method];
  const status = order.payment_status;
  const open = order.status === "pending_payment" && status !== "verified";

  return (
    <section aria-labelledby="pay-heading" className="rounded-2xl border border-neutral-200 p-6">
      <h2 id="pay-heading" className="text-lg font-semibold">Payment: {label}</h2>

      {status === "verified" && (
        <p role="status" className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900">
          Your payment is confirmed. Thank you!
        </p>
      )}
      {status === "submitted" && (
        <p role="status" className="mt-3 rounded-xl bg-accent-soft px-4 py-3 text-sm">
          We&apos;ve received your payment details and will confirm them soon. You can send them again below if you made a mistake.
        </p>
      )}
      {status === "rejected" && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          We couldn&apos;t verify your payment.{order.payment_note ? ` ${order.payment_note}` : ""} Please check and send your details again.
        </p>
      )}

      {open && (
        <>
          <p className="mt-4 text-sm text-neutral-700">
            Send <strong>{formatPKR(order.total)}</strong> to the account below
            {method !== "bank_transfer" ? `, then enter your ${label} transaction ID.` : ", then upload your receipt."}{" "}
            Use <strong>{order.order_number}</strong> as the reference if there is a place for one.
          </p>

          <dl className="mt-4 rounded-xl bg-cream px-4 py-2">
            {method === "bank_transfer" ? (
              <>
                {info.bank_name && <Detail label="Bank" value={info.bank_name} />}
                {info.account_title && <Detail label="Account title" value={info.account_title} />}
                {info.account_number && <Detail label="Account number" value={info.account_number} />}
                {info.iban && <Detail label="IBAN" value={info.iban} />}
              </>
            ) : (
              <>
                {info.account_title && <Detail label="Account name" value={info.account_title} />}
                {info.number && <Detail label={`${label} number`} value={info.number} />}
              </>
            )}
          </dl>

          <PaymentProofForm token={token} method={method} />
        </>
      )}
    </section>
  );
}

export default async function OrderPage({ params }: { params: { token: string } }) {
  const order = await getOrderByToken(params.token);
  if (!order) notFound();

  const settings = await getSetting<PaymentSettings>("payments", {} as PaymentSettings);
  const cancelled = order.status === "cancelled";
  const waitingForPayment = order.status === "pending_payment";
  const helpText = encodeURIComponent(`Hi ${siteConfig.name}! About my order ${order.order_number}.`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent-ink">
          {cancelled ? "Order cancelled" : "Order placed"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {cancelled ? `Order ${order.order_number}` : `Thank you, ${order.first_name}!`}
        </h1>
        <p className="mt-2 text-neutral-700">
          {cancelled
            ? "This order has been cancelled."
            : waitingForPayment
              ? <>Your order number is <strong>{order.order_number}</strong>. Please complete your payment below so we can start preparing it.</>
              : <>Your order number is <strong>{order.order_number}</strong>. We&apos;ll start preparing it soon.</>}
        </p>
      </header>

      <div className="mt-8 space-y-8">
        <OrderTimeline status={order.status} method={order.payment_method} />

        {order.tracking_note && (
          <div className="rounded-xl bg-accent-soft p-4 text-sm">
            <p className="font-medium">Update from us</p>
            <p className="mt-1 whitespace-pre-line">{order.tracking_note}</p>
          </div>
        )}

        {!cancelled && <PaymentSection order={order} token={params.token} settings={settings} />}

        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="mb-3 text-lg font-semibold">Your items</h2>
          <OrderSummary order={order} />
        </section>

        <section aria-labelledby="delivery-heading">
          <h2 id="delivery-heading" className="mb-3 text-lg font-semibold">Delivery details</h2>
          <address className="rounded-xl bg-cream p-4 text-sm not-italic leading-relaxed">
            <p className="font-medium">{order.name}</p>
            <p>{order.phone}</p>
            {order.email && <p>{order.email}</p>}
            <p className="mt-2 whitespace-pre-line">{order.address}</p>
            <p>{order.city}</p>
            {order.notes && <p className="mt-2 text-neutral-600">Note: {order.notes}</p>}
          </address>
        </section>

        <ShareOrderLink />

        <p className="text-sm text-neutral-700">
          Questions?{" "}
          <a
            href={`https://wa.me/${siteConfig.whatsappNumber}?text=${helpText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-ink underline"
          >
            Message us on WhatsApp
          </a>
          .
        </p>
      </div>
    </div>
  );
}
