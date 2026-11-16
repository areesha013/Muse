"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPayment, type PaymentState } from "@/app/actions/orders";
import type { PaymentMethod } from "@/lib/orders";
import { MAX_RECEIPT_BYTES } from "@/lib/orders";

const input = "mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-500";

export function PaymentProofForm({ token, method }: { token: string; method: PaymentMethod }) {
  const router = useRouter();
  const [state, setState] = useState<PaymentState>(null);
  const [pending, startTransition] = useTransition();
  const isBank = method === "bank_transfer";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("token", token);

    const file = data.get("receipt");
    if (file instanceof File && file.size > MAX_RECEIPT_BYTES) {
      setState({ ok: false, message: "That file is too big. Please upload an image under 5 MB." });
      return;
    }

    startTransition(async () => {
      const result = await submitPayment(null, data);
      setState(result);
      if (result?.ok) {
        form.reset();
        router.refresh(); // reloads the order page with the new status
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
      <div>
        <label htmlFor="sender_name" className="block text-sm font-medium">
          Name on the account you paid from {isBank && <span className="font-normal text-neutral-600">(optional)</span>}
        </label>
        <input id="sender_name" name="sender_name" autoComplete="name" className={input} required={!isBank} />
      </div>
      <div>
        <label htmlFor="transaction_id" className="block text-sm font-medium">
          {isBank ? "Transfer reference (optional)" : "Transaction ID"}
        </label>
        <input id="transaction_id" name="transaction_id" autoComplete="off" className={input} required={!isBank} />
        {!isBank && <p className="mt-1 text-xs text-neutral-600">You&apos;ll find it in the confirmation message from {method === "jazzcash" ? "JazzCash" : "Easypaisa"}.</p>}
      </div>
      <div>
        <label htmlFor="receipt" className="block text-sm font-medium">
          {isBank ? "Receipt photo or screenshot" : "Screenshot (optional)"}
        </label>
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required={isBank}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-700"
        />
        <p className="mt-1 text-xs text-neutral-600">JPG, PNG or WebP, up to 5 MB.</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
      >
        {pending ? "Sending..." : "Send payment details"}
      </button>

      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${state?.ok ? "text-green-800" : "text-red-700"}`}>
        {state?.message}
      </p>
    </form>
  );
}
