"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTrackingNote, setOrderStatus } from "@/app/actions/admin-orders";
import type { OrderStatus } from "@/lib/orders";
import { cn } from "@/lib/utils";

const NEXT: Partial<Record<OrderStatus, { status: string; label: string }>> = {
  confirmed: { status: "packed", label: "Mark as packed" },
  packed: { status: "shipped", label: "Mark as shipped" },
  shipped: { status: "delivered", label: "Mark as delivered" },
};
const CAN_CANCEL: OrderStatus[] = ["pending_payment", "confirmed", "packed"];

export function OrderActions({ orderId, status, trackingNote }: { orderId: string; status: OrderStatus; trackingNote: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState(trackingNote ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const next = NEXT[status];
  const final = status === "delivered" || status === "cancelled";

  function run(fn: () => ReturnType<typeof setOrderStatus>) {
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message ?? "" });
      setConfirmCancel(false);
      if (r.ok) router.refresh();
    });
  }

  return (
    <section aria-labelledby="actions-h" className="rounded-2xl border border-neutral-200 p-5">
      <h2 id="actions-h" className="font-semibold">Update this order</h2>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cn("mt-3 rounded-xl px-4 py-3 text-sm", msg.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800")}>
          {msg.text}
        </p>
      )}

      <label htmlFor="tracking-note" className="mt-4 block text-sm font-medium">
        Note for the customer <span className="font-normal text-neutral-600">(shown on their tracking page, optional)</span>
      </label>
      <textarea
        id="tracking-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="For example: Sent with TCS, tracking number 123456"
        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-500"
      />

      <div className="mt-3 flex flex-wrap gap-3">
        {next && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setOrderStatus(orderId, next.status, note))}
            className="h-11 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-700 disabled:bg-neutral-300"
          >
            {next.label}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => saveTrackingNote(orderId, status, note))}
          className="h-11 rounded-full border border-neutral-900 px-6 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50"
        >
          Save note only
        </button>
      </div>

      {status === "pending_payment" && (
        <p className="mt-3 text-sm text-neutral-600">This order is waiting for payment. Check the payment below. Verifying it confirms the order.</p>
      )}
      {final && <p className="mt-3 text-sm text-neutral-600">This order is {status}. Its status can no longer change.</p>}

      {CAN_CANCEL.includes(status) && (
        <div className="mt-5 border-t border-neutral-200 pt-4">
          {!confirmCancel ? (
            <button type="button" onClick={() => setConfirmCancel(true)} className="text-sm font-medium text-red-700 underline">
              Cancel this order
            </button>
          ) : (
            <div role="alertdialog" aria-label="Confirm cancel" className="rounded-xl bg-red-50 p-4">
              <p className="text-sm text-red-900">Cancel this order? The items go back into stock. This cannot be undone.</p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setOrderStatus(orderId, "cancelled", note))}
                  className="h-10 rounded-full bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                >
                  Yes, cancel it
                </button>
                <button type="button" onClick={() => setConfirmCancel(false)} className="h-10 rounded-full border border-neutral-400 px-5 text-sm font-medium hover:bg-white">
                  No, keep it
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
