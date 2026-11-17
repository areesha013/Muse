"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReview, setReviewStatus } from "@/app/actions/admin-reviews";
import { Message } from "@/components/admin/ui";

type Status = "pending" | "approved" | "hidden";

export function ReviewActions({ id, status }: { id: string; status: Status }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message ?? "" });
      setConfirm(false);
      router.refresh();
    });

  const solid = "h-10 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50";
  const line = "h-10 rounded-full border border-neutral-900 px-5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "approved" && <button type="button" disabled={pending} onClick={() => run(() => setReviewStatus(id, "approved"))} className={solid}>Approve</button>}
        {status !== "hidden" && <button type="button" disabled={pending} onClick={() => run(() => setReviewStatus(id, "hidden"))} className={line}>Hide</button>}
        {!confirm ? (
          <button type="button" onClick={() => setConfirm(true)} className="text-sm text-red-700 underline">Delete</button>
        ) : (
          <span className="flex items-center gap-3 text-sm">
            Delete for good?
            <button type="button" disabled={pending} onClick={() => run(() => deleteReview(id))} className="rounded-full border border-red-700 px-4 py-1.5 text-red-700 hover:bg-red-50">Yes, delete</button>
            <button type="button" onClick={() => setConfirm(false)} className="underline">No</button>
          </span>
        )}
      </div>
      <Message msg={msg} />
    </div>
  );
}
