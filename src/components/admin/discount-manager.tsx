"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDiscount, saveDiscount } from "@/app/actions/admin-discounts";
import { btnOutline, btnPrimary, Check, Field, inputCls, Message } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export type Disc = {
  id: string | null; code: string; type: "percentage" | "fixed"; value: string; min_order: string;
  max_uses: string; expires_on: string; is_active: boolean; times_used: number; expired: boolean;
};

export const EMPTY_DISCOUNT: Disc = { id: null, code: "", type: "percentage", value: "", min_order: "", max_uses: "", expires_on: "", is_active: true, times_used: 0, expired: false };

function stateLabel(d: Disc): { text: string; cls: string } {
  if (!d.is_active) return { text: "Switched off", cls: "bg-neutral-200 text-neutral-800" };
  if (d.expired) return { text: "Expired", cls: "bg-neutral-200 text-neutral-800" };
  if (d.max_uses && d.times_used >= Number(d.max_uses)) return { text: "All used up", cls: "bg-neutral-200 text-neutral-800" };
  return { text: "Active", cls: "bg-green-100 text-green-900" };
}

function DiscountRow({ disc, isNew }: { disc: Disc; isNew?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(disc);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const id = disc.id ?? "new";
  const st = stateLabel(disc);

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveDiscount({ id: disc.id, code: v.code, type: v.type, value: v.value, min_order: v.min_order, max_uses: v.max_uses, expires_on: v.expires_on, is_active: v.is_active });
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) {
        if (isNew) setV(EMPTY_DISCOUNT);
        router.refresh();
      }
    });
  }
  function del() {
    start(async () => {
      const r = await deleteDiscount(disc.id!);
      setMsg({ ok: r.ok, text: r.message ?? "" });
      if (r.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-neutral-200 p-4" aria-label={isNew ? "Add a discount code" : `Discount code ${disc.code}`}>
      {!isNew && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-lg font-semibold tracking-wide">{disc.code}</span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", st.cls)}>{st.text}</span>
          <span className="text-neutral-600">Used {disc.times_used}{disc.max_uses ? ` of ${disc.max_uses}` : ""} {disc.times_used === 1 ? "time" : "times"}</span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={`d-code-${id}`} label="Code" hint="what customers type">
          <input id={`d-code-${id}`} value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase().replace(/\s/g, "") })} maxLength={24} placeholder="EID25" className={inputCls} autoCapitalize="characters" />
        </Field>
        <Field id={`d-type-${id}`} label="Type">
          <select id={`d-type-${id}`} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as Disc["type"] })} className={inputCls}>
            <option value="percentage">Percent off (%)</option>
            <option value="fixed">Fixed amount off (Rs)</option>
          </select>
        </Field>
        <Field id={`d-val-${id}`} label={v.type === "percentage" ? "Percent off" : "Rs off"}>
          <input id={`d-val-${id}`} inputMode="decimal" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} placeholder={v.type === "percentage" ? "10" : "200"} className={inputCls} />
        </Field>
        <Field id={`d-min-${id}`} label="Minimum order (Rs)" hint="optional">
          <input id={`d-min-${id}`} inputMode="decimal" value={v.min_order} onChange={(e) => setV({ ...v, min_order: e.target.value })} placeholder="1000" className={inputCls} />
        </Field>
        <Field id={`d-max-${id}`} label="Maximum uses" hint="empty = unlimited">
          <input id={`d-max-${id}`} inputMode="numeric" value={v.max_uses} onChange={(e) => setV({ ...v, max_uses: e.target.value.replace(/\D/g, "") })} placeholder="50" className={inputCls} />
        </Field>
        <Field id={`d-exp-${id}`} label="Last day" hint="optional">
          <input id={`d-exp-${id}`} type="date" value={v.expires_on} onChange={(e) => setV({ ...v, expires_on: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <Check id={`d-act-${id}`} label="Switched on" hint="Turn off to stop the code without deleting it." checked={v.is_active} onChange={(c) => setV({ ...v, is_active: c })} />
      <Message msg={msg} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={isNew ? btnPrimary : btnOutline}>{pending ? "Saving..." : isNew ? "Create code" : "Save"}</button>
        {!isNew && !confirmDel && <button type="button" onClick={() => setConfirmDel(true)} className="text-sm text-red-700 underline">Delete</button>}
        {!isNew && confirmDel && (
          <span className="flex items-center gap-3 text-sm">
            Delete this code? Past orders keep their discount.
            <button type="button" disabled={pending} onClick={del} className="rounded-full border border-red-700 px-4 py-1.5 text-red-700 hover:bg-red-50">Yes, delete</button>
            <button type="button" onClick={() => setConfirmDel(false)} className="underline">No</button>
          </span>
        )}
      </div>
    </form>
  );
}

export function DiscountManager({ discounts }: { discounts: Disc[] }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="new-code" className="space-y-3">
        <h2 id="new-code" className="font-semibold">Add a code</h2>
        <DiscountRow disc={EMPTY_DISCOUNT} isNew />
      </section>
      <section aria-labelledby="all-codes" className="space-y-3">
        <h2 id="all-codes" className="font-semibold">Your codes</h2>
        {discounts.length === 0 && <p className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-600">No codes yet.</p>}
        {discounts.map((d) => <DiscountRow key={d.id} disc={d} />)}
      </section>
    </div>
  );
}
