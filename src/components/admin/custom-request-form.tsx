"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomRequest, updateCustomRequest } from "@/app/actions/admin-custom";
import { CUSTOM_STATUSES, CUSTOM_STATUS_LABEL, type CustomStatus } from "@/lib/custom-order";
import { btnPrimary, Field, inputCls, Message } from "@/components/admin/ui";
import { MessageCircle } from "lucide-react";

export function CustomRequestForm({ id, status, quote, reply, hasEmail, whatsappHref }: {
  id: string; status: CustomStatus; quote: string; reply: string; hasEmail: boolean; whatsappHref: string;
}) {
  const router = useRouter();
  const [v, setV] = useState({ status, quote, reply });
  const [email, setEmail] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await updateCustomRequest({ id, status: v.status, quote: v.quote, reply: v.reply, emailCustomer: email });
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) { setEmail(false); router.refresh(); }
    });
  }
  function del() {
    start(async () => {
      const r = await deleteCustomRequest(id);
      if (r.ok) router.push("/admin/custom");
      else setMsg({ ok: false, text: r.message ?? "" });
    });
  }
  const waLink = v.reply.trim() ? `${whatsappHref}${encodeURIComponent(`${v.quote ? `Price: Rs ${v.quote}\n` : ""}${v.reply.trim()}`)}` : whatsappHref;

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-neutral-200 p-5" aria-labelledby="reply-h">
      <h2 id="reply-h" className="font-semibold">Reply and update</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cr-status" label="Status">
          <select id="cr-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as CustomStatus })} className={inputCls}>
            {CUSTOM_STATUSES.map((s) => <option key={s} value={s}>{CUSTOM_STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field id="cr-quote" label="Price (Rs)" hint="your quote, optional">
          <input id="cr-quote" inputMode="decimal" value={v.quote} onChange={(e) => setV({ ...v, quote: e.target.value })} placeholder="2500" className={inputCls} />
        </Field>
      </div>
      <Field id="cr-reply" label="Message to the customer" hint="shown in their account if they have one">
        <textarea id="cr-reply" rows={4} maxLength={2000} value={v.reply} onChange={(e) => setV({ ...v, reply: e.target.value })} placeholder="Thank you! We can make this in 7 days for Rs 2500..." className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={email} disabled={!hasEmail} onChange={(e) => setEmail(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-neutral-400" />
        <span>Also email this to the customer{!hasEmail && <span className="block text-neutral-600">They did not give an email. Use WhatsApp below.</span>}</span>
      </label>
      <Message msg={msg} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={btnPrimary}>{pending ? "Saving..." : "Save"}</button>
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-neutral-900 px-5 text-sm font-medium hover:bg-neutral-100">
          <MessageCircle size={16} aria-hidden /> Message on WhatsApp
        </a>
        {!confirmDel ? (
          <button type="button" onClick={() => setConfirmDel(true)} className="text-sm text-red-700 underline">Delete request</button>
        ) : (
          <span className="flex items-center gap-3 text-sm">
            Delete for good?
            <button type="button" disabled={pending} onClick={del} className="rounded-full border border-red-700 px-4 py-1.5 text-red-700 hover:bg-red-50">Yes, delete</button>
            <button type="button" onClick={() => setConfirmDel(false)} className="underline">No</button>
          </span>
        )}
      </div>
    </form>
  );
}
