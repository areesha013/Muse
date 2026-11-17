"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewPayment } from "@/app/actions/admin-orders";
import type { OrderStatus, PaymentStatus } from "@/lib/orders";
import { cn } from "@/lib/utils";

export function PaymentReview({ orderId, paymentStatus, orderStatus }: { orderId: string; paymentStatus: PaymentStatus; orderStatus: OrderStatus }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const closed = orderStatus === "cancelled";
  const canVerify = !closed && paymentStatus !== "verified";
  const canReject = !closed && orderStatus === "pending_payment" && paymentStatus !== "verified";
  if (!canVerify && !canReject) return null;

  function run(action: "verify" | "reject") {
    start(async () => {
      const r = await reviewPayment(orderId, action, note);
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) {
        setRejecting(false);
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-4 border-t border-neutral-200 pt-4">
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cn("mb-3 rounded-xl px-4 py-3 text-sm", msg.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800")}>
          {msg.text}
        </p>
      )}
      {!rejecting ? (
        <div className="flex flex-wrap gap-3">
          {canVerify && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run("verify")}
              className="h-11 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-700 disabled:bg-neutral-300"
            >
              {pending ? "Saving..." : "Payment received: verify"}
            </button>
          )}
          {canReject && (
            <button type="button" onClick={() => setRejecting(true)} className="h-11 rounded-full border border-red-700 px-6 text-sm font-medium text-red-800 hover:bg-red-50">
              Reject payment
            </button>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="reject-note" className="block text-sm font-medium">Tell the customer why (they will see this)</label>
          <input
            id="reject-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="For example: Transaction ID not found. Please check and send again."
            className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-500"
          />
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={pending || note.trim().length === 0}
              onClick={() => run("reject")}
              className="h-10 rounded-full bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-40"
            >
              Reject payment
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="h-10 rounded-full border border-neutral-400 px-5 text-sm font-medium hover:bg-neutral-50">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
