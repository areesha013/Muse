"use client";

import { useState, useTransition } from "react";
import { trackOrder, type TrackState } from "@/app/actions/orders";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderSummary } from "@/components/order-summary";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, STATUS_LABEL } from "@/lib/orders";

const input = "mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-500";

export function TrackOrderForm() {
  const [state, setState] = useState<TrackState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => setState(await trackOrder(null, data)));
  }

  const order = state?.ok ? state.order : null;

  return (
    <div>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div>
          <label htmlFor="order" className="block text-sm font-medium">Order number</label>
          <input id="order" name="order" placeholder="ORD-1005" autoComplete="off" className={input} required />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium">Mobile number used for the order</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" placeholder="0300 1234567" autoComplete="tel" className={input} required />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-full bg-neutral-900 px-8 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
          >
            {pending ? "Looking..." : "Track order"}
          </button>
        </div>
      </form>

      <p role="alert" className="mt-4 min-h-5 text-sm text-red-700">
        {state && !state.ok ? state.message : ""}
      </p>

      {order && (
        <section aria-labelledby="track-result" className="mt-6 space-y-8 rounded-2xl border border-neutral-200 p-6">
          <div>
            <h2 id="track-result" className="text-xl font-semibold">{order.order_number}</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Placed {new Date(order.created_at).toLocaleDateString("en-PK", { dateStyle: "medium" })} &middot; Delivering to {order.city}
            </p>
            <p className="mt-2 text-sm font-medium">Status: {STATUS_LABEL[order.status]}</p>
          </div>

          <OrderTimeline status={order.status} method={order.payment_method} />

          {order.tracking_note && (
            <div className="rounded-xl bg-accent-soft p-4 text-sm">
              <p className="font-medium">Update from us</p>
              <p className="mt-1 whitespace-pre-line">{order.tracking_note}</p>
            </div>
          )}

          <p className="text-sm text-neutral-700">
            <span className="font-medium">Payment:</span> {PAYMENT_METHOD_LABEL[order.payment_method]}
            {order.payment_method !== "cod" && <> &middot; {PAYMENT_STATUS_LABEL[order.payment_status]}</>}
          </p>
          {order.status === "pending_payment" && (
            <p className="text-sm text-neutral-700">
              Haven&apos;t sent your payment details yet? Open the order page link you saw after checkout, or message us on WhatsApp.
            </p>
          )}

          <OrderSummary order={order} />
        </section>
      )}
    </div>
  );
}
